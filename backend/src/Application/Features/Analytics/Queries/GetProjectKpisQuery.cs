using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Headline KPI strip for the engineering dashboard: open tasks, on-schedule
/// percentage, bug ratio (tasks carrying a "bug"/"defect" label, since the
/// schema has no task-type field), and average cycle time over work completed
/// in the last 30 days. Ratios are null when there is nothing to measure so the
/// UI shows an em dash.
/// </summary>
public record GetProjectKpisQuery(Guid ProjectId) : IRequest<Result<ProjectKpisDto>>;

public class GetProjectKpisQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectKpisQuery, Result<ProjectKpisDto>>
{
    private static readonly string[] BugLabelNames = ["bug", "defect"];

    public async Task<Result<ProjectKpisDto>> Handle(GetProjectKpisQuery request, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId)
            .Select(t => new { t.Status, t.DueDate })
            .ToListAsync(ct);

        var total = tasks.Count;
        static bool IsOpen(DomainTaskStatus s) =>
            s != DomainTaskStatus.Done && s != DomainTaskStatus.WontDo;

        var openTasks = tasks.Count(t => IsOpen(t.Status));
        var openWithDue = tasks.Count(t => IsOpen(t.Status) && t.DueDate != null);
        var overdue = tasks.Count(t => IsOpen(t.Status) && t.DueDate != null && t.DueDate!.Value.Date < today);
        double? onTrack = openWithDue > 0 ? Math.Round(100.0 * (openWithDue - overdue) / openWithDue) : null;

        // Bug ratio — distinct tasks carrying a bug/defect label over all tasks.
        double? bugRatio = null;
        if (total > 0)
        {
            var bugCount = await db.TaskLabels
                .Where(tl => tl.Task.ProjectId == request.ProjectId
                    && BugLabelNames.Contains(tl.Label.Name.ToLower()))
                .Select(tl => tl.TaskId)
                .Distinct()
                .CountAsync(ct);
            bugRatio = Math.Round(100.0 * bugCount / total);
        }

        // Cycle time — first InProgress to last Done, for tasks currently Done.
        var doneIds = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId && t.Status == DomainTaskStatus.Done)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var changes = await db.TaskStatusChanges
            .Where(c => doneIds.Contains(c.TaskId)
                && (c.ToStatus == DomainTaskStatus.InProgress || c.ToStatus == DomainTaskStatus.Done))
            .Select(c => new { c.TaskId, c.ToStatus, c.CreatedAt })
            .ToListAsync(ct);

        var since = today.AddDays(-30);
        var spans = changes
            .GroupBy(c => c.TaskId)
            .Select(g => new
            {
                Start = g.Where(c => c.ToStatus == DomainTaskStatus.InProgress)
                    .Select(c => (DateTime?)c.CreatedAt).Min(),
                End = g.Where(c => c.ToStatus == DomainTaskStatus.Done)
                    .Select(c => (DateTime?)c.CreatedAt).Max(),
            })
            .Where(x => x.Start != null && x.End != null && x.End!.Value.Date >= since)
            .Select(x => (x.Start!.Value, x.End!.Value));

        var avgCycle = CycleTimeCalculator.AverageDays(spans);

        return Result.Success(new ProjectKpisDto(openTasks, onTrack, bugRatio, avgCycle));
    }
}
