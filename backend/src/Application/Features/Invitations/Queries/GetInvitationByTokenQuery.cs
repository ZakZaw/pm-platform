using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Invitations.Queries;

public record GetInvitationByTokenQuery(string Token) : IRequest<Result<InvitationPreviewDto>>;

// Anonymous read. Returns enough context for AcceptInvitePage to render
// without leaking anything sensitive: no token, no internal ids, no inviter
// email. NotFound is returned for both unknown tokens and (deliberately)
// for any error - we don't want this endpoint to be a probe.
public class GetInvitationByTokenQueryHandler(IAppDbContext db)
    : IRequestHandler<GetInvitationByTokenQuery, Result<InvitationPreviewDto>>
{
    public async Task<Result<InvitationPreviewDto>> Handle(GetInvitationByTokenQuery request, CancellationToken ct)
    {
        var invitation = await db.Invitations
            .Where(i => i.Token == request.Token)
            .Select(i => new
            {
                i.Email,
                i.Role,
                i.ExpiresAt,
                i.AcceptedAt,
                OrgName = i.Organization.Name,
                OrgSlug = i.Organization.Slug,
                InviterName = i.CreatedBy.FullName
            })
            .FirstOrDefaultAsync(ct);

        if (invitation is null)
            return Result.Failure<InvitationPreviewDto>(InvitationErrors.NotFound);

        var now = DateTime.UtcNow;
        return Result.Success(new InvitationPreviewDto(
            invitation.Email,
            invitation.Role.ToString(),
            invitation.OrgName,
            invitation.OrgSlug,
            invitation.InviterName,
            invitation.ExpiresAt,
            IsExpired: now >= invitation.ExpiresAt,
            IsAccepted: invitation.AcceptedAt.HasValue));
    }
}
