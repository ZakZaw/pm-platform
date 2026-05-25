using Domain.Enums;

namespace Application.Interfaces;

/// <summary>
/// Queues an in-app notification for delivery. Like
/// <see cref="IActivityRecorder"/>, this method does not save — the caller's
/// unit of work commits the row alongside the rest of the command's writes,
/// then publishes a NotificationArrived event for SignalR push.
/// </summary>
public interface INotificationService
{
    void Enqueue(
        Guid userId,
        Guid orgId,
        Guid? projectId,
        Guid? actorId,
        NotificationKind kind,
        string title,
        string? bodyMd = null,
        string? linkUrl = null,
        string? targetType = null,
        Guid? targetId = null);
}
