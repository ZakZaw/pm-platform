using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Queries;

public record GetWorkflowQuery(Guid WorkflowId) : IRequest<Result<WorkflowDetailDto>>;

public record WorkflowDetailDto(
    WorkflowDto Workflow,
    IReadOnlyList<WorkflowRunDto> Runs);

public class GetWorkflowQueryHandler(IAppDbContext db)
    : IRequestHandler<GetWorkflowQuery, Result<WorkflowDetailDto>>
{
    public async Task<Result<WorkflowDetailDto>> Handle(
        GetWorkflowQuery request, CancellationToken ct)
    {
        var w = await db.Workflows.FirstOrDefaultAsync(x => x.Id == request.WorkflowId, ct);
        if (w is null) return Result.Failure<WorkflowDetailDto>(OperationsErrors.WorkflowNotFound);

        var now = DateTime.UtcNow;
        await RunMaterializer.EnsureUpcomingRunsAsync(db, w.ProjectId, now, ct: ct);

        var runs = await db.WorkflowRuns
            .Where(r => r.WorkflowId == w.Id)
            .OrderByDescending(r => r.ScheduledFor)
            .ToListAsync(ct);

        var itemCounts = await db.ChecklistItems
            .Where(i => runs.Select(r => r.Id).Contains(i.RunId))
            .GroupBy(i => i.RunId)
            .Select(g => new
            {
                RunId = g.Key,
                Total = g.Count(),
                Done = g.Count(i => i.Completed),
            })
            .ToDictionaryAsync(g => g.RunId, ct);

        var runDtos = runs.Select(r =>
        {
            var counts = itemCounts.GetValueOrDefault(r.Id);
            return new WorkflowRunDto(
                r.Id, r.WorkflowId, w.Name,
                r.ScheduledFor, r.StartedAt, r.CompletedAt,
                r.Status.ToString(), r.SkippedReason, r.OwnerId,
                ItemCount: counts?.Total ?? 0,
                CompletedItemCount: counts?.Done ?? 0,
                IsOverdue: r.Status == WorkflowRunStatus.Pending && r.ScheduledFor <= now);
        }).ToList();

        var next = runs.Where(r => r.Status is WorkflowRunStatus.Pending or WorkflowRunStatus.InProgress)
            .OrderBy(r => r.ScheduledFor).FirstOrDefault();
        var last = runs.Where(r => r.Status == WorkflowRunStatus.Completed)
            .OrderByDescending(r => r.CompletedAt).FirstOrDefault();
        var lastAny = runs.OrderByDescending(r => r.CompletedAt ?? r.StartedAt ?? r.ScheduledFor).FirstOrDefault();

        var wDto = new WorkflowDto(
            w.Id, w.ProjectId, w.Name, w.Description, w.RecurrenceRule, w.OwnerId,
            RunMaterializer.ParseTemplate(w.TemplateJson),
            w.CreatedAt, w.ArchivedAt,
            NextRunAt: next?.ScheduledFor,
            LastCompletedAt: last?.CompletedAt,
            LastRunStatus: lastAny?.Status.ToString(),
            PendingRunCount: runs.Count(r => r.Status == WorkflowRunStatus.Pending),
            OverdueRunCount: runs.Count(r => r.Status == WorkflowRunStatus.Pending && r.ScheduledFor <= now));

        return Result.Success(new WorkflowDetailDto(wDto, runDtos));
    }
}
