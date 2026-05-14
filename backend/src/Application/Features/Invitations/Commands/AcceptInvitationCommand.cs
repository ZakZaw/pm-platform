using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Invitations.Commands;

public record AcceptInvitationCommand(string Token) : IRequest<Result<AcceptInvitationResultDto>>;

// Requires an authenticated user (controller has [Authorize]). Strictly
// enforces that the authenticated user's email matches the invited email -
// the token alone is not bearer-of-authority.
public class AcceptInvitationCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<AcceptInvitationCommand, Result<AcceptInvitationResultDto>>
{
    public async Task<Result<AcceptInvitationResultDto>> Handle(AcceptInvitationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AcceptInvitationResultDto>(AuthErrors.NotAuthenticated);

        var invitation = await db.Invitations
            .Include(i => i.Organization)
            .FirstOrDefaultAsync(i => i.Token == request.Token, ct);
        if (invitation is null)
            return Result.Failure<AcceptInvitationResultDto>(InvitationErrors.NotFound);

        if (invitation.IsAccepted)
            return Result.Failure<AcceptInvitationResultDto>(InvitationErrors.AlreadyAccepted);

        var now = DateTime.UtcNow;
        if (invitation.IsExpired(now))
            return Result.Failure<AcceptInvitationResultDto>(InvitationErrors.Expired);

        var user = await db.Users.FirstAsync(u => u.Id == userId, ct);
        if (!string.Equals(user.Email, invitation.Email, StringComparison.OrdinalIgnoreCase))
            return Result.Failure<AcceptInvitationResultDto>(InvitationErrors.EmailMismatch);

        var alreadyMember = await db.OrgMemberships
            .AnyAsync(m => m.OrganizationId == invitation.OrganizationId
                        && m.UserId == userId
                        && m.RemovedAt == null, ct);
        if (alreadyMember)
            return Result.Failure<AcceptInvitationResultDto>(InvitationErrors.AlreadyMember);

        db.OrgMemberships.Add(new OrgMembership
        {
            OrganizationId = invitation.OrganizationId,
            UserId = userId,
            Role = invitation.Role,
            JoinedAt = now
        });
        invitation.MarkAccepted(userId, now);

        await db.SaveChangesAsync(ct);

        return Result.Success(new AcceptInvitationResultDto(
            invitation.Organization.Id,
            invitation.Organization.Name,
            invitation.Organization.Slug,
            invitation.Role.ToString()));
    }
}
