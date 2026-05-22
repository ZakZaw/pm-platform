using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Queries;

public record GetRunQuery(Guid RunId) : IRequest<Result<WorkflowRunDetailDto>>;

public class GetRunQueryHandler(IAppDbContext db)
    : IRequestHandler<GetRunQuery, Result<WorkflowRunDetailDto>>
{
    public async Task<Result<WorkflowRunDetailDto>> Handle(GetRunQuery request, CancellationToken ct)
    {
        var run = await db.WorkflowRuns
            .Where(r => r.Id == request.RunId)
            .Join(db.Workflows, r => r.WorkflowId, w => w.Id,
                (r, w) => new { Run = r, w.Name })
            .FirstOrDefaultAsync(ct);
        if (run is null) return Result.Failure<WorkflowRunDetailDto>(OperationsErrors.RunNotFound);

        var items = await db.ChecklistItems
            .Where(i => i.RunId == run.Run.Id)
            .OrderBy(i => i.Order)
            .Select(i => new ChecklistItemDto(
                i.Id, i.RunId, i.Title, i.Completed, i.CompletedBy, i.CompletedAt,
                i.Order, i.Sequential))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var dto = new WorkflowRunDto(
            run.Run.Id, run.Run.WorkflowId, run.Name,
            run.Run.ScheduledFor, run.Run.StartedAt, run.Run.CompletedAt,
            run.Run.Status.ToString(), run.Run.SkippedReason, run.Run.OwnerId,
            ItemCount: items.Count,
            CompletedItemCount: items.Count(i => i.Completed),
            IsOverdue: run.Run.Status == WorkflowRunStatus.Pending && run.Run.ScheduledFor <= now);

        return Result.Success(new WorkflowRunDetailDto(dto, items));
    }
}
