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

    internal static string GroupName(Guid projectId) => $"project:{projectId:D}";
    internal static string GroupName(string projectId) => $"project:{projectId}";
}
