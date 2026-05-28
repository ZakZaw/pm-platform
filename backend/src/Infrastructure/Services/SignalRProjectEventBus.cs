using Application.Interfaces;
using Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Infrastructure.Services;

public class SignalRProjectEventBus(IHubContext<ProjectHub> hub) : IProjectEventBus
{
    public Task PublishAsync(Guid projectId, string eventName, object? payload, CancellationToken ct = default)
    {
        return hub.Clients
            .Group(ProjectHub.GroupName(projectId))
            .SendAsync(eventName, payload, ct);
    }

    public Task PublishToUserAsync(Guid userId, string eventName, object? payload, CancellationToken ct = default)
    {
        return hub.Clients
            .User(userId.ToString())
            .SendAsync(eventName, payload, ct);
    }

    public Task PublishToChannelAsync(Guid channelId, string eventName, object? payload, CancellationToken ct = default)
    {
        return hub.Clients
            .Group(ProjectHub.ChannelGroupName(channelId))
            .SendAsync(eventName, payload, ct);
    }

    public Task PublishToMeetingAsync(Guid meetingId, string eventName, object? payload, CancellationToken ct = default)
    {
        return hub.Clients
            .Group(ProjectHub.MeetingGroupName(meetingId))
            .SendAsync(eventName, payload, ct);
    }
}
