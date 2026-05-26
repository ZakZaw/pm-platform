using Application.Features.Sprints.Retrospective;
using Application.Interfaces;
using MediatR;

namespace Application.Features.Sprints.Notifications;

/// <summary>
/// Fired by <see cref="Commands.CloseSprintCommand"/> right after the
/// sprint flips to Closed. The retro auto-generation handler kicks off
/// the AI call inline — handler failures are swallowed and the user's
/// close request returns successfully either way (the retro can be
/// regenerated from the sprint detail page on demand).
/// </summary>
public record SprintClosedNotification(Guid SprintId, Guid ProjectId) : INotification;

public class GenerateRetroOnSprintCloseHandler(
    IMediator mediator,
    IAIControlGate aiGate)
    : INotificationHandler<SprintClosedNotification>
{
    public async Task Handle(SprintClosedNotification n, CancellationToken ct)
    {
        // Cheap pre-check so we don't spin up the full generate path
        // (and AI audit log) when the project has AI off. The command
        // re-checks the gate as the canonical guard.
        if (!await aiGate.IsAllowedAsync(n.ProjectId, ct)) return;
        await mediator.Send(new GenerateSprintRetrospectiveCommand(n.SprintId), ct);
    }
}
