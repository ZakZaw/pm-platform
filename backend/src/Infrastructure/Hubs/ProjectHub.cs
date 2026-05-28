using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Infrastructure.Hubs;

/// <summary>
/// SignalR hub at /hubs/project. Clients call JoinProject(projectId) after
/// connecting; everyone in that group gets server-pushed events when a
/// command handler calls IProjectEventBus.PublishAsync. The group name is
/// "project:{guid}" -- emitted from the Infrastructure event bus.
///
/// Per-user pushes (notifications) don't need a join call — SignalR auto-
/// tracks each connection's UserIdentifier from the JWT's Sub claim. Server
/// code calls IProjectEventBus.PublishToUserAsync, which maps to
/// Clients.User(userId). Event names live in
/// Application.Interfaces.ProjectEvents / UserEvents.
/// </summary>
[Authorize]
public class ProjectHub : Hub
{
    public Task JoinProject(string projectId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(projectId));

    public Task LeaveProject(string projectId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(projectId));

    // F2-18 chat: clients join one channel group at a time so live
    // message events only fan out to people actually looking at the
    // channel. Membership access is enforced by command-level checks,
    // not by the hub — joining a group you don't belong to just means
    // you'd see events for messages you also can't post.
    public Task JoinChannel(string channelId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, ChannelGroupName(channelId));

    public Task LeaveChannel(string channelId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, ChannelGroupName(channelId));

    // F2-21 transcript: clients join the meeting:{id} group on entry
    // so transcript segments only fan out to people currently in the
    // room, not the whole project.
    public Task JoinMeeting(string meetingId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, MeetingGroupName(meetingId));

    public Task LeaveMeeting(string meetingId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, MeetingGroupName(meetingId));

    internal static string GroupName(Guid projectId) => $"project:{projectId:D}";
    internal static string GroupName(string projectId) => $"project:{projectId}";
    internal static string ChannelGroupName(Guid channelId) => $"channel:{channelId:D}";
    internal static string ChannelGroupName(string channelId) => $"channel:{channelId}";
    internal static string MeetingGroupName(Guid meetingId) => $"meeting:{meetingId:D}";
    internal static string MeetingGroupName(string meetingId) => $"meeting:{meetingId}";
}
