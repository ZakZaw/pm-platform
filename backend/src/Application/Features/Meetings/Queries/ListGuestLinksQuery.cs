using Application.Common;
using Application.Features.Meetings.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Queries;

/// <summary>
/// F2-20 — organiser-only list of guest links on a meeting. Includes
/// revoked + expired rows so the UI can show "revoked 2h ago" rather
/// than silently dropping them.
/// </summary>
public record ListGuestLinksQuery(Guid MeetingId)
    : IRequest<Result<IReadOnlyList<MeetingGuestLinkDto>>>;

public class ListGuestLinksQueryHandler(
    IAppDbContext db, ICurrentUser currentUser, GuestLinkUrlBuilder urls)
    : IRequestHandler<ListGuestLinksQuery, Result<IReadOnlyList<MeetingGuestLinkDto>>>
{
    public async Task<Result<IReadOnlyList<MeetingGuestLinkDto>>> Handle(
        ListGuestLinksQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MeetingGuestLinkDto>>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.OrganizerId })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<IReadOnlyList<MeetingGuestLinkDto>>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<IReadOnlyList<MeetingGuestLinkDto>>(MeetingErrors.NotOrganiser);

        var rows = await db.MeetingGuestLinks
            .Where(g => g.MeetingId == request.MeetingId)
            .OrderByDescending(g => g.CreatedAt)
            .ToListAsync(ct);
        var items = rows
            .Select(r => CreateGuestLinkCommandHandler.ToDto(r, urls))
            .ToList();
        return Result.Success<IReadOnlyList<MeetingGuestLinkDto>>(items);
    }
}
