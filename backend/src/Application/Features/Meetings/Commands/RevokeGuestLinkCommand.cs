using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-20 — invalidate a guest link without removing the row, so any
/// future attempt to join with that token gets <c>GuestLinkExpired</c>.
/// Organiser only.
/// </summary>
public record RevokeGuestLinkCommand(Guid GuestLinkId) : IRequest<Result<Guid>>;

public class RevokeGuestLinkCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<RevokeGuestLinkCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(RevokeGuestLinkCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<Guid>(AuthErrors.NotAuthenticated);

        var link = await db.MeetingGuestLinks
            .Include(g => g.Meeting)
            .FirstOrDefaultAsync(g => g.Id == request.GuestLinkId, ct);
        if (link is null)
            return Result.Failure<Guid>(MeetingErrors.GuestLinkNotFound);
        if (link.Meeting.OrganizerId != userId)
            return Result.Failure<Guid>(MeetingErrors.NotOrganiser);

        if (link.RevokedAt is null)
        {
            link.RevokedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return Result.Success(link.Id);
    }
}
