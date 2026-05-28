using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Meetings.Processing;

/// <summary>
/// F2-22 — accept a single action-item draft. Two paths:
///
///   1. <see cref="ExistingTaskId"/> set: link the draft to that task.
///      No new task is created; we still stamp the draft as accepted
///      and write <c>SourceMeetingId</c> on the linked task so it
///      surfaces the "From meeting" affordance.
///   2. <see cref="ExistingTaskId"/> null: create a fresh task on the
///      meeting's project. Title / assignee / due / priority come from
///      the body (defaults from the draft suggestion).
///
/// The handler is also reused by the bulk variant — see
/// <see cref="AcceptActionItemsBulkCommand"/>.
/// </summary>
public record AcceptActionItemCommand(
    Guid ActionItemId,
    Guid? ExistingTaskId,
    string? Title,
    string? Description,
    Guid? AssigneeId,
    DateTime? DueDate,
    string? Priority) : IRequest<Result<MeetingActionItemDto>>;

public class AcceptActionItemCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AcceptActionItemCommand, Result<MeetingActionItemDto>>
{
    public async Task<Result<MeetingActionItemDto>> Handle(
        AcceptActionItemCommand request, CancellationToken ct)
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

        Guid linkedTaskId;
        if (request.ExistingTaskId is { } existingId)
        {
            var task = await db.Tasks
                .Where(t => t.Id == existingId && t.ProjectId == item.Meeting.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (task is null)
                return Result.Failure<MeetingActionItemDto>(TaskErrors.NotFound);

            // Stamp the source meeting so the task drawer shows the
            // "From meeting" affordance. We don't overwrite an existing
            // SourceMeetingId — a task should only be claimed by the
            // first meeting that referenced it.
            task.SourceMeetingId ??= item.MeetingId;
            linkedTaskId = task.Id;
        }
        else
        {
            var title = (request.Title ?? item.Title).Trim();
            if (title.Length < 2 || title.Length > 300)
                return Result.Failure<MeetingActionItemDto>(ActionItemErrors.InvalidTitle);

            var assigneeId = request.AssigneeId ?? item.SuggestedOwnerUserId;
            var priority = ParsePriority(request.Priority) ?? item.SuggestedPriority;
            var due = request.DueDate ?? item.SuggestedDueDate;

            // KeyNum: next per-project serial. Keep the same logic the
            // create-task command uses so display keys stay monotonic.
            var nextKeyNum = await db.Tasks
                .Where(t => t.ProjectId == item.Meeting.ProjectId)
                .MaxAsync(t => (int?)t.KeyNum, ct) ?? 0;

            var task = new TaskEntity
            {
                ProjectId = item.Meeting.ProjectId,
                KeyNum = nextKeyNum + 1,
                Title = title,
                Description = string.IsNullOrWhiteSpace(request.Description)
                    ? item.Description
                    : request.Description.Trim(),
                AssigneeId = assigneeId,
                ReporterId = userId,
                DueDate = due,
                Priority = priority,
                CreatedByAi = true,
                SourceMeetingId = item.MeetingId,
            };
            db.Tasks.Add(task);
            linkedTaskId = task.Id;
        }

        item.AcceptedAt = DateTime.UtcNow;
        item.AcceptedTaskId = linkedTaskId;
        item.AcceptedByUserId = userId;

        await db.SaveChangesAsync(ct);

        return Result.Success(await BuildDtoAsync(db, item.Id, ct));
    }

    internal static async Task<MeetingActionItemDto> BuildDtoAsync(
        IAppDbContext db, Guid actionItemId, CancellationToken ct)
    {
        return await db.MeetingActionItems
            .Where(a => a.Id == actionItemId)
            .Select(a => new MeetingActionItemDto(
                a.Id, a.MeetingId, a.Title, a.Description,
                a.SuggestedOwnerUserId,
                a.SuggestedOwner != null ? a.SuggestedOwner.FullName : null,
                a.SuggestedDueDate,
                a.SuggestedPriority.ToString(),
                a.OrderIndex,
                a.AcceptedAt, a.AcceptedTaskId, a.DismissedAt))
            .FirstAsync(ct);
    }

    private static Priority? ParsePriority(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : null;
    }
}
