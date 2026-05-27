using Application.Common;
using Application.Features.AI.Notifications;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Members.Commands;

public record RemoveOrgMemberCommand(string Slug, Guid UserId) : IRequest<Result>;

// Admin+ via [RequireOrgRole]. Owners can only be removed by another Owner,
// and the last Owner cannot be removed. Soft-delete: sets RemovedAt; the
// row stays for history. Partial unique index lets the same user be
// re-invited later.
public class RemoveOrgMemberCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IPublisher mediatorPublisher)
    : IRequestHandler<RemoveOrgMemberCommand, Result>
{
    public async Task<Result> Handle(RemoveOrgMemberCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } callerId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure(OrgErrors.NotFound);

        var callerRole = await db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id && m.UserId == callerId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (callerRole is null)
            return Result.Failure(OrgErrors.NotFound);

        var target = await db.OrgMemberships
            .FirstOrDefaultAsync(m => m.OrganizationId == org.Id
                                   && m.UserId == request.UserId
                                   && m.RemovedAt == null, ct);
        if (target is null)
            return Result.Failure(OrgErrors.MemberNotFound);

        if (target.Role == OrgRole.Owner && callerRole != OrgRole.Owner)
            return Result.Failure(OrgErrors.CannotModifyOwner);

        if (target.Role == OrgRole.Owner)
        {
            var otherOwners = await db.OrgMemberships
                .CountAsync(m => m.OrganizationId == org.Id
                              && m.Role == OrgRole.Owner
                              && m.UserId != target.UserId
                              && m.RemovedAt == null, ct);
            if (otherOwners == 0)
                return Result.Failure(OrgErrors.LastOwner);
        }

        target.RemovedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        // F2-13 — fan out the trigger so the reassignment scorer can
        // suggest takeovers for the removed member's open tasks. Scoped
        // to this org so we don't accidentally walk projects in orgs
        // the user is still a member of. Failures don't reverse the
        // removal that already committed.
        try
        {
            await mediatorPublisher.Publish(
                new MemberBecameUnavailableNotification(
                    target.UserId, "org_removed", org.Id), ct);
        }
        catch { /* logged in handler */ }

        return Result.Success();
    }
}
