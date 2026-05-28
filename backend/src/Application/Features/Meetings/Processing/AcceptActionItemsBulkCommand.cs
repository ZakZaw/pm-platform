using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — bulk-accept every pending draft on a meeting. Each item
/// creates a fresh task using its suggested owner / due / priority;
/// the AC mandates "atomic" so the whole batch persists in one
/// SaveChanges call or rolls back together.
/// </summary>
public record AcceptActionItemsBulkCommand(Guid MeetingId, IReadOnlyList<Guid> ActionItemIds)
    : IRequest<Result<IReadOnlyList<MeetingActionItemDto>>>;

public class AcceptActionItemsBulkCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AcceptActionItemsBulkCommand, Result<IReadOnlyList<MeetingActionItemDto>>>
{
    public async Task<Result<IReadOnlyList<MeetingActionItemDto>>> Handle(
        AcceptActionItemsBulkCommand request, CancellationToken ct)
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

        var ids = (request.ActionItemIds ?? []).Distinct().ToList();
        var items = await db.MeetingActionItems
            .Where(a => a.MeetingId == request.MeetingId && ids.Contains(a.Id))
            .OrderBy(a => a.OrderIndex)
            .ToListAsync(ct);
        if (items.Count != ids.Count)
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(ActionItemErrors.NotFound);
        if (items.Any(i => i.AcceptedAt is not null))
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(ActionItemErrors.AlreadyAccepted);
        if (items.Any(i => i.DismissedAt is not null))
            return Result.Failure<IReadOnlyList<MeetingActionItemDto>>(ActionItemErrors.AlreadyDismissed);

        var startingKeyNum = await db.Tasks
            .Where(t => t.ProjectId == meeting.ProjectId)
            .MaxAsync(t => (int?)t.KeyNum, ct) ?? 0;

        var now = DateTime.UtcNow;
        var offset = 1;
        foreach (var item in items)
        {
            var task = new TaskEntity
            {
                ProjectId = meeting.ProjectId,
                KeyNum = startingKeyNum + offset++,
                Title = item.Title,
                Description = item.Description,
                AssigneeId = item.SuggestedOwnerUserId,
                ReporterId = userId,
                DueDate = item.SuggestedDueDate,
                Priority = item.SuggestedPriority,
                CreatedByAi = true,
                SourceMeetingId = meeting.Id,
            };
            db.Tasks.Add(task);
            item.AcceptedAt = now;
            item.AcceptedTaskId = task.Id;
            item.AcceptedByUserId = userId;
        }

        await db.SaveChangesAsync(ct);

        // Return the freshly-accepted DTOs in order.
        var dtos = new List<MeetingActionItemDto>(items.Count);
        foreach (var item in items)
        {
            dtos.Add(await AcceptActionItemCommandHandler.BuildDtoAsync(db, item.Id, ct));
        }
        return Result.Success<IReadOnlyList<MeetingActionItemDto>>(dtos);
    }
}
