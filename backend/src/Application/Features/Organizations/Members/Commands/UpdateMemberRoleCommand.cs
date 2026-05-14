using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Members.Commands;

public record UpdateMemberRoleCommand(string Slug, Guid UserId, OrgRole NewRole)
    : IRequest<Result<OrgMemberDto>>;

// Admin+ via [RequireOrgRole]. Handler enforces the Owner-specific rules:
//   - Only an Owner can promote anyone to Owner.
//   - Only an Owner can change an existing Owner's role.
//   - The last Owner cannot be demoted (org must always have >= 1 Owner).
public class UpdateMemberRoleCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateMemberRoleCommand, Result<OrgMemberDto>>
{
    public async Task<Result<OrgMemberDto>> Handle(UpdateMemberRoleCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } callerId)
            return Result.Failure<OrgMemberDto>(AuthErrors.NotAuthenticated);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrgMemberDto>(OrgErrors.NotFound);

        var callerRole = await db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id && m.UserId == callerId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (callerRole is null)
            return Result.Failure<OrgMemberDto>(OrgErrors.NotFound);

        var target = await db.OrgMemberships
            .Include(m => m.User)
            .FirstOrDefaultAsync(m => m.OrganizationId == org.Id
                                   && m.UserId == request.UserId
                                   && m.RemovedAt == null, ct);
        if (target is null)
            return Result.Failure<OrgMemberDto>(OrgErrors.MemberNotFound);

        var callerIsOwner = callerRole == OrgRole.Owner;

        if (request.NewRole == OrgRole.Owner && !callerIsOwner)
            return Result.Failure<OrgMemberDto>(OrgErrors.CannotPromoteToOwner);

        if (target.Role == OrgRole.Owner && !callerIsOwner)
            return Result.Failure<OrgMemberDto>(OrgErrors.CannotModifyOwner);

        if (target.Role == request.NewRole)
            return Result.Success(ToDto(target));

        // Last-Owner guard: if we're demoting an Owner, make sure at least one
        // other active Owner exists.
        if (target.Role == OrgRole.Owner && request.NewRole != OrgRole.Owner)
        {
            var otherOwners = await db.OrgMemberships
                .CountAsync(m => m.OrganizationId == org.Id
                              && m.Role == OrgRole.Owner
                              && m.UserId != target.UserId
                              && m.RemovedAt == null, ct);
            if (otherOwners == 0)
                return Result.Failure<OrgMemberDto>(OrgErrors.LastOwner);
        }

        target.Role = request.NewRole;
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(target));
    }

    private static OrgMemberDto ToDto(Domain.Entities.OrgMembership m) => new(
        m.UserId, m.User.Email, m.User.FullName, m.User.AvatarUrl,
        m.Role.ToString(), m.JoinedAt);
}
