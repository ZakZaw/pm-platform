using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — drop an action-item draft without creating a task. Stamps
/// <see cref="Domain.Entities.MeetingActionItem.DismissedAt"/> so the
/// row stays around for the audit trail (and a future re-run of the
/// AI doesn't re-propose it).
/// </summary>
public record DismissActionItemCommand(Guid ActionItemId)
    : IRequest<Result<MeetingActionItemDto>>;

public class DismissActionItemCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<DismissActionItemCommand, Result<MeetingActionItemDto>>
{
    public async Task<Result<MeetingActionItemDto>> Handle(
        DismissActionItemCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingActionItemDto>(AuthErrors.NotAuthenticated);

        var item = await db.MeetingActionItems
            .Include(a => a.Meeting)
            .FirstOrDefaultAsync(a => a.Id == request.ActionItemId, ct);
        if (item is null)
            return Result.Failure<MeetingActionItemDto>(ActionItemErrors.NotFound);
        if (item.AcceptedAt is not null)
            return Result.Failure<MeetingActionItemDto>(ActionItemErrors.AlreadyAccepted);
        if (item.DismissedAt is not null)
            return Result.Failure<MeetingActionItemDto>(ActionItemErrors.AlreadyDismissed);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == item.Meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<MeetingActionItemDto>(MeetingErrors.NotFound);

        item.DismissedAt = DateTime.UtcNow;
        item.DismissedByUserId = userId;
        await db.SaveChangesAsync(ct);

        return Result.Success(await AcceptActionItemCommandHandler.BuildDtoAsync(db, item.Id, ct));
    }
}
