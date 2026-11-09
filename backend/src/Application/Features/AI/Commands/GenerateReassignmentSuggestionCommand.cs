using Microsoft.EntityFrameworkCore;
using Application.Common;
using Application.Features.AI.Notifications;
using Application.Interfaces;
using MediatR;

namespace Application.Features.AI.Commands;

/// <summary>
/// F2-13 — manual trigger surface. Fans out the same
/// <see cref="MemberBecameUnavailableNotification"/> that the soft
/// triggers use, so a PM can preview reassignment suggestions for a
/// teammate without waiting for them to mark themselves OOO.
///
/// L4: the endpoint requires org Admin+ in <c>org_id</c> (API filter), and
/// the target must belong to that org; the fan-out is always scoped to
/// that one org, never cross-org.
/// </summary>
public record GenerateReassignmentSuggestionCommand(
    Guid UserId, Guid? OrgId) : IRequest<Result>;

public class GenerateReassignmentSuggestionCommandHandler(
    IAppDbContext db,
    IPublisher mediatorPublisher)
    : IRequestHandler<GenerateReassignmentSuggestionCommand, Result>
{
    public async Task<Result> Handle(
        GenerateReassignmentSuggestionCommand request, CancellationToken ct)
    {
        if (request.OrgId is not { } orgId)
            return Result.Failure(OrgErrors.NotFound);

        var targetInOrg = await db.OrgMemberships
            .AnyAsync(m => m.OrganizationId == orgId && m.UserId == request.UserId, ct);
        if (!targetInOrg)
            return Result.Failure(OrgErrors.MemberNotFound);

        await mediatorPublisher.Publish(
            new MemberBecameUnavailableNotification(
                request.UserId, "manual", request.OrgId), ct);
        return Result.Success();
    }
}
