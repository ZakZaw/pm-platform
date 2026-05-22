using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Commands;

/// <summary>
/// Toggles a checklist item's completed flag. When <c>Sequential</c> is
/// true the handler enforces that all earlier items in the run are
/// already completed before this one can be ticked (uncompleting an
/// earlier item is allowed regardless of order). When the last item in
/// the run flips to completed, the run itself is auto-completed —
/// satisfying the F1.5-05 AC.
/// </summary>
public record ToggleChecklistItemCommand(Guid ItemId, bool Completed) : IRequest<Result>;

public class ToggleChecklistItemCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ToggleChecklistItemCommand, Result>
{
    public async Task<Result> Handle(ToggleChecklistItemCommand request, CancellationToken ct)
    {
        var item = await db.ChecklistItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, ct);
        if (item is null) return Result.Failure(OperationsErrors.ChecklistItemNotFound);

        var run = await db.WorkflowRuns.FirstOrDefaultAsync(r => r.Id == item.RunId, ct);
        if (run is null) return Result.Failure(OperationsErrors.RunNotFound);

        if (run.Status is WorkflowRunStatus.Completed or WorkflowRunStatus.Skipped)
            return Result.Failure(OperationsErrors.RunAlreadyTerminal);

        if (request.Completed && item.Sequential)
        {
            var earlierIncomplete = await db.ChecklistItems
                .AnyAsync(i => i.RunId == item.RunId
                               && i.Order < item.Order
                               && !i.Completed, ct);
            if (earlierIncomplete)
                return Result.Failure(OperationsErrors.SequentialOrderViolated);
        }

        var now = DateTime.UtcNow;
        if (request.Completed && !item.Completed)
        {
            item.Completed = true;
            item.CompletedAt = now;
            item.CompletedBy = currentUser.UserId;
        }
        else if (!request.Completed && item.Completed)
        {
            item.Completed = false;
            item.CompletedAt = null;
            item.CompletedBy = null;
        }

        // Auto-start the run on the first tick so the owner doesn't have
        // to remember to hit a "Start" button before working.
        if (item.Completed && run.Status == WorkflowRunStatus.Pending)
        {
            run.Status = WorkflowRunStatus.InProgress;
            run.StartedAt = now;
            if (run.OwnerId is null) run.OwnerId = currentUser.UserId;
        }

        // Auto-complete the run if every item is now ticked.
        var anyOutstanding = await db.ChecklistItems
            .AnyAsync(i => i.RunId == item.RunId && !i.Completed && i.Id != item.Id, ct);
        if (item.Completed && !anyOutstanding)
        {
            run.Status = WorkflowRunStatus.Completed;
            run.CompletedAt = now;
        }
        else if (!item.Completed && run.Status == WorkflowRunStatus.Completed)
        {
            // Un-ticking after completion reopens the run.
            run.Status = WorkflowRunStatus.InProgress;
            run.CompletedAt = null;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
