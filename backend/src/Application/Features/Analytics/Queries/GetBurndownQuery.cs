using System.Text.Json;
using Application.Common;
using Application.Features.Sprints;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// AN-01 — sprint burndown. When <see cref="SprintId"/> is null the project's
/// active sprint is used. The committed total and the per-task points come
/// from the sprint's scope baseline snapshot when present (so a closed sprint
/// reports against the scope it actually started with, not the carryover-
/// stripped current set); otherwise the live tasks are used.
/// </summary>
public record GetBurndownQuery(Guid ProjectId, Guid? SprintId) : IRequest<Result<BurndownDto>>;

public class GetBurndownQueryHandler(IAppDbContext db)
    : IRequestHandler<GetBurndownQuery, Result<BurndownDto>>
{
    private static readonly BurndownDto Empty = new(null, null, 0, 0, 0, []);

    public async Task<Result<BurndownDto>> Handle(GetBurndownQuery request, CancellationToken ct)
    {
        var sprint = request.SprintId is { } sid
            ? await db.Sprints.FirstOrDefaultAsync(
                s => s.Id == sid && s.ProjectId == request.ProjectId, ct)
            : await db.Sprints.FirstOrDefaultAsync(
                s => s.ProjectId == request.ProjectId && s.Status == SprintStatus.Active, ct);

        if (sprint is null)
            return Result.Success(Empty);

        // Scope baseline gives us the points-per-task as they stood at sprint
        // start. Falling back to the live tasks covers a sprint that was never
        // formally started (still in Planning).
        Dictionary<Guid, int> pointsByTask;
        if (!string.IsNullOrWhiteSpace(sprint.ScopeBaselineJson))
        {
            var baseline = JsonSerializer.Deserialize<List<ScopeBaselineTask>>(sprint.ScopeBaselineJson) ?? [];
            pointsByTask = baseline
                .GroupBy(t => t.TaskId)
                .ToDictionary(g => g.Key, g => g.First().StoryPoints ?? 0);
        }
        else
        {
            pointsByTask = await db.Tasks
                .Where(t => t.SprintId == sprint.Id)
                .Select(t => new { t.Id, t.StoryPoints })
                .ToDictionaryAsync(t => t.Id, t => t.StoryPoints ?? 0, ct);
        }

        var total = pointsByTask.Values.Sum();
        var taskIds = pointsByTask.Keys.ToList();

        // A task counts as burned down only if its CURRENT status is Done —
        // reopened tasks climb back onto the actual line. The completion
        // moment is the latest transition into Done.
        var doneIds = await db.Tasks
            .Where(t => taskIds.Contains(t.Id) && t.Status == DomainTaskStatus.Done)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var doneAt = await db.TaskStatusChanges
            .Where(c => doneIds.Contains(c.TaskId) && c.ToStatus == DomainTaskStatus.Done)
            .GroupBy(c => c.TaskId)
            .Select(g => new { TaskId = g.Key, At = g.Max(c => c.CreatedAt) })
            .ToDictionaryAsync(x => x.TaskId, x => x.At, ct);

        var now = DateTime.UtcNow;
        // Fall back to the sprint start for a Done task that has no recorded
        // transition (e.g. imported already-complete) so it shows as burned
        // from day one rather than vanishing from the total.
        var completions = doneIds.Select(id => new BurndownCalculator.Completion(
            doneAt.TryGetValue(id, out var at) ? at : sprint.StartDate,
            pointsByTask.GetValueOrDefault(id)));

        var points = BurndownCalculator
            .Build(sprint.StartDate, sprint.EndDate, now, total, completions)
            .Select(p => new BurndownPointDto(p.DayIndex, p.Date, p.Ideal, p.Remaining))
            .ToList();

        var days = points.Count > 0 ? points.Count - 1 : 0;
        var todayIndex = BurndownCalculator.TodayIndex(sprint.StartDate, sprint.EndDate, now);

        return Result.Success(new BurndownDto(
            sprint.Id, sprint.Name, total, days, todayIndex, points));
    }
}
