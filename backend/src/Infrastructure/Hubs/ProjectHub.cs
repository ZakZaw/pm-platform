using System.Security.Claims;
using Application.Authorization;
using Application.Common;
using Domain.Enums;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Infrastructure.Hubs;

/// <summary>
/// SignalR hub at /hubs/project. Clients call JoinProject(projectId) after
/// connecting; everyone in that group gets server-pushed events when a
/// command handler calls IProjectEventBus.PublishAsync. The group name is
/// "project:{guid}" -- emitted from the Infrastructure event bus.
///
/// Per-user pushes (notifications) don't need a join call: SignalR auto-
/// tracks each connection's UserIdentifier from the JWT's Sub claim. Server
/// code calls IProjectEventBus.PublishToUserAsync, which maps to
/// Clients.User(userId). Event names live in
/// Application.Interfaces.ProjectEvents / UserEvents.
///
/// H1: every Join* call is authorised with the same rules as the REST API
/// (<see cref="IAccessControl"/>): project membership for project and
/// meeting groups, channel membership for channel groups. Ids are parsed
/// as GUIDs so group names are canonical ("D" format) and match what the
/// event bus publishes to.
/// </summary>
[Authorize]
public class ProjectHub(IAccessControl access) : Hub
{
    public async Task JoinProject(string projectId)
    {
        var id = ParseId(projectId);
        Ensure(await access.CheckProjectAsync(Principal(), id, ProjectRole.Viewer, Context.ConnectionAborted));
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(id));
    }

    public Task LeaveProject(string projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(ParseId(projectId)));

    // F2-18 chat: clients join one channel group at a time so live
    // message events only fan out to people actually looking at the
    // channel.
    public async Task JoinChannel(string channelId)
    {
        var id = ParseId(channelId);
        Ensure(await access.CheckChannelAsync(Principal(), id, Context.ConnectionAborted));
        await Groups.AddToGroupAsync(Context.ConnectionId, ChannelGroupName(id));
    }

    public Task LeaveChannel(string channelId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ChannelGroupName(ParseId(channelId)));

    // F2-21 transcript: clients join the meeting:{id} group on entry so
    // transcript segments only fan out to people in the room. Same gate
    // as GET /meetings/{id}/transcript: any member of the meeting's project.
    public async Task JoinMeeting(string meetingId)
    {
        var id = ParseId(meetingId);
        var ct = Context.ConnectionAborted;
        var projectId = await access.ResolveProjectIdAsync(ProjectScope.Meeting, id, ct)
            ?? throw new HubException("Meeting not found.");
        Ensure(await access.CheckProjectAsync(Principal(), projectId, ProjectRole.Viewer, ct));
        await Groups.AddToGroupAsync(Context.ConnectionId, MeetingGroupName(id));
    }

    public Task LeaveMeeting(string meetingId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, MeetingGroupName(ParseId(meetingId)));

    private AccessPrincipal Principal()
    {
        var user = Context.User;
        var sub = user?.FindFirstValue(ClaimTypes.NameIdentifier) ?? user?.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var userId))
            throw new HubException("Not authenticated.");
        return new AccessPrincipal(userId, ApiKeyAuthenticationHandler.GetApiKeyOrgId(user));
    }

    private static Guid ParseId(string raw) =>
        Guid.TryParse(raw, out var id) ? id : throw new HubException("Invalid id.");

    private static void Ensure(Result result)
    {
        if (!result.IsSuccess)
            throw new HubException("You do not have access to this resource.");
    }

    internal static string GroupName(Guid projectId) => $"project:{projectId:D}";
    internal static string ChannelGroupName(Guid channelId) => $"channel:{channelId:D}";
    internal static string MeetingGroupName(Guid meetingId) => $"meeting:{meetingId:D}";
}