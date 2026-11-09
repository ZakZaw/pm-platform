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
// row stays for history, while project/channel memberships and the user's
// API keys in this org are removed/revoked. Partial unique index lets the same user be
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

        var now = DateTime.UtcNow;
        target.RemovedAt = now;

        // H2 - removal must actually revoke access: drop the user's project
        // and channel memberships inside this org and revoke the API keys
        // they created for it. (The access checks also require an active
        // org membership, so this is belt and braces.)
        var orgProjectIds = db.Projects.Where(p => p.OrganizationId == org.Id).Select(p => p.Id);
        db.ProjectMemberships.RemoveRange(await db.ProjectMemberships
            .Where(m => m.UserId == target.UserId && orgProjectIds.Contains(m.ProjectId))
            .ToListAsync(ct));

        var orgChannelIds = db.Channels.Where(c => c.OrganizationId == org.Id).Select(c => c.Id);
        db.ChannelMembers.RemoveRange(await db.ChannelMembers
            .Where(m => m.UserId == target.UserId && orgChannelIds.Contains(m.ChannelId))
            .ToListAsync(ct));

        var keys = await db.ApiKeys
            .Where(k => k.OrganizationId == org.Id && k.CreatedByUserId == target.UserId && k.RevokedAt == null)
            .ToListAsync(ct);
        foreach (var key in keys) key.RevokedAt = now;

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
