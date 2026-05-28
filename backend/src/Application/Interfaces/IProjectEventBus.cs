namespace Application.Interfaces;

/// <summary>
/// Fire-and-forget pub-sub used by command handlers to notify project
/// clients (via SignalR) that something changed. Keeping the abstraction
/// in Application means handlers don't take a hard dependency on SignalR
/// and can be unit-tested with a no-op fake.
///
/// Event names live in <see cref="ProjectEvents"/> / <see cref="UserEvents"/>.
/// Don't pass raw strings — typos silently lose messages.
/// </summary>
public interface IProjectEventBus
{
    /// <summary>
    /// Push an event to every client currently in the project's hub group.
    /// </summary>
    Task PublishAsync(Guid projectId, string eventName, object? payload, CancellationToken ct = default);

    /// <summary>
    /// Push an event to all of a single user's connected clients (every tab,
    /// every device). Backed by SignalR's <c>Clients.User</c> mapping —
    /// requires the JWT to carry a Sub claim, which our JwtService does.
    /// </summary>
    Task PublishToUserAsync(Guid userId, string eventName, object? payload, CancellationToken ct = default);

    /// <summary>
    /// Push an event to every client currently in the channel's hub group.
    /// Used by F2-18 chat for live message / reaction updates. Clients
    /// call <c>JoinChannel(channelId)</c> after they open a channel.
    /// </summary>
    Task PublishToChannelAsync(Guid channelId, string eventName, object? payload, CancellationToken ct = default);

    /// <summary>
    /// Push an event to every client currently in the meeting's hub group.
    /// Used by F2-21 transcript chunks. Clients call
    /// <c>JoinMeeting(meetingId)</c> after they enter the room.
    /// </summary>
    Task PublishToMeetingAsync(Guid meetingId, string eventName, object? payload, CancellationToken ct = default);
}
