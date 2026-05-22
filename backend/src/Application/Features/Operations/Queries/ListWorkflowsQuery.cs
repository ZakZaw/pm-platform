using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Queries;

/// <summary>
/// Lists every workflow in an Operations project with its template,
/// next-scheduled run, and last-completed status. Materialises any
/// missing future runs (within the default 7-day horizon) on the way
/// through — that's how the AC's "background job" requirement is met
/// without standing up a worker; the next visit to the page advances
/// the schedule.
/// </summary>
public record ListWorkflowsQuery(Guid ProjectId, bool IncludeArchived = false)
    : IRequest<Result<IReadOnlyList<WorkflowDto>>>;

public class ListWorkflowsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListWorkflowsQuery, Result<IReadOnlyList<WorkflowDto>>>
{
    public async Task<Result<IReadOnlyList<WorkflowDto>>> Handle(
        ListWorkflowsQuery request, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await RunMaterializer.EnsureUpcomingRunsAsync(db, request.ProjectId, now, ct: ct);

        var workflows = await db.Workflows
            .Where(w => w.ProjectId == request.ProjectId
                        && (request.IncludeArchived || w.ArchivedAt == null))
            .OrderBy(w => w.Name)
            .ToListAsync(ct);
        if (workflows.Count == 0)
            return Result.Success<IReadOnlyList<WorkflowDto>>([]);

        var ids = workflows.Select(w => w.Id).ToList();
        var runs = await db.WorkflowRuns
            .Where(r => ids.Contains(r.WorkflowId))
            .ToListAsync(ct);

        var byWorkflow = runs.GroupBy(r => r.WorkflowId).ToDictionary(g => g.Key, g => g.ToList());

        var dtos = workflows.Select(w =>
        {
            var wRuns = byWorkflow.GetValueOrDefault(w.Id) ?? [];
            var next = wRuns
                .Where(r => r.Status is WorkflowRunStatus.Pending or WorkflowRunStatus.InProgress)
                .OrderBy(r => r.ScheduledFor)
                .FirstOrDefault();
            var last = wRuns
                .Where(r => r.Status == WorkflowRunStatus.Completed)
                .OrderByDescending(r => r.CompletedAt)
                .FirstOrDefault();
            var lastAny = wRuns
                .OrderByDescending(r => r.CompletedAt ?? r.StartedAt ?? r.ScheduledFor)
                .FirstOrDefault();
            var pending = wRuns.Count(r => r.Status == WorkflowRunStatus.Pending);
            var overdue = wRuns.Count(r =>
                r.Status == WorkflowRunStatus.Pending && r.ScheduledFor <= now);

            return new WorkflowDto(
                w.Id, w.ProjectId, w.Name, w.Description, w.RecurrenceRule, w.OwnerId,
                RunMaterializer.ParseTemplate(w.TemplateJson),
                w.CreatedAt, w.ArchivedAt,
                NextRunAt: next?.ScheduledFor,
                LastCompletedAt: last?.CompletedAt,
                LastRunStatus: lastAny?.Status.ToString(),
                PendingRunCount: pending,
                OverdueRunCount: overdue);
        }).ToList();

        return Result.Success<IReadOnlyList<WorkflowDto>>(dtos);
    }
}
