using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — list every action-item draft on a meeting. Includes
/// accepted + dismissed rows so the panel can render the full
/// audit trail.
/// </summary>
public record ListActionItemsQuery(Guid MeetingId)
    : IRequest<Result<IReadOnlyList<MeetingActionItemDto>>>;

public class ListActionItemsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListActionItemsQuery, Result<IReadOnlyList<MeetingActionItemDto>>>
{
    public async Task<Result<IReadOnlyList<MeetingActionItemDto>>> Handle(
        ListActionItemsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(MeetingErrors.NotFound);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(MeetingErrors.NotFound);

        var items = await db.MeetingActionItems
            .Where(a => a.MeetingId == request.MeetingId)
            .OrderBy(a => a.OrderIndex)
            .Select(a => new MeetingActionItemDto(
                a.Id, a.MeetingId, a.Title, a.Description,
                a.SuggestedOwnerUserId,
                a.SuggestedOwner != null ? a.SuggestedOwner.FullName : null,
                a.SuggestedDueDate,
                a.SuggestedPriority.ToString(),
                a.OrderIndex,
                a.AcceptedAt, a.AcceptedTaskId, a.DismissedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<MeetingActionItemDto>>(items);
    }
}
