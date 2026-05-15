namespace Application.Interfaces;

/// <summary>
/// Fire-and-forget pub-sub used by command handlers to notify project
/// clients (via SignalR) that something changed. Keeping the abstraction
/// in Application means handlers don't take a hard dependency on SignalR
/// and can be unit-tested with a no-op fake.
/// </summary>
public interface IProjectEventBus
{
    Task PublishAsync(Guid projectId, string eventName, object? payload, CancellationToken ct = default);
}
