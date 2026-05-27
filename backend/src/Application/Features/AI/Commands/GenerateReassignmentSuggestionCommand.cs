using Application.Common;
using Application.Features.AI.Notifications;
using Application.Interfaces;
using MediatR;

namespace Application.Features.AI.Commands;

/// <summary>
/// F2-13 — manual trigger surface. Fans out the same
/// <see cref="MemberBecameUnavailableNotification"/> that the soft
/// triggers use, so a PM can preview reassignment suggestions for a
/// teammate without waiting for them to mark themselves OOO. The
/// scope (org-wide vs cross-org) is controlled by the caller.
/// </summary>
public record GenerateReassignmentSuggestionCommand(
    Guid UserId, Guid? OrgId) : IRequest<Result>;

public class GenerateReassignmentSuggestionCommandHandler(
    IPublisher mediatorPublisher)
    : IRequestHandler<GenerateReassignmentSuggestionCommand, Result>
{
    public async Task<Result> Handle(
        GenerateReassignmentSuggestionCommand request, CancellationToken ct)
    {
        await mediatorPublisher.Publish(
            new MemberBecameUnavailableNotification(
                request.UserId, "manual", request.OrgId), ct);
        return Result.Success();
    }
}
