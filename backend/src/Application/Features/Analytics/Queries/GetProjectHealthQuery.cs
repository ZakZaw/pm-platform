using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Composite project-health snapshot (F3-16), computed on demand. Replaces the
/// placeholder gauge on the engineering dashboard. The score and its component
/// signals are derived live from open work, blockers, overdue items, WIP and
/// the active sprint's pace — see <see cref="HealthScoreCalculator"/>.
/// </summary>
public record GetProjectHealthQuery(Guid ProjectId) : IRequest<Result<HealthDto>>;

public class GetProjectHealthQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectHealthQuery, Result<HealthDto>>
{
    public async Task<Result<HealthDto>> Handle(GetProjectHealthQuery request, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId)
            .Select(t => new { t.Status, t.DueDate })
            .ToListAsync(ct);

        static bool IsOpen(DomainTaskStatus s) =>
            s != DomainTaskStatus.Done && s != DomainTaskStatus.WontDo;

        var blocked = tasks.Count(t => t.Status == DomainTaskStatus.Blocked);
        var inProgress = tasks.Count(t => t.Status == DomainTaskStatus.InProgress);
        var openWithDue = tasks.Count(t => IsOpen(t.Status) && t.DueDate != null);
        var overdue = tasks.Count(t => IsOpen(t.Status) && t.DueDate != null && t.DueDate!.Value.Date < today);

        var teamSize = await db.ProjectMemberships.CountAsync(m => m.ProjectId == request.ProjectId, ct);

        // Active-sprint pace: behind when remaining points exceed the ideal
        // burndown at today by a small tolerance.
        var sprint = await db.Sprints.FirstOrDefaultAsync(
            s => s.ProjectId == request.ProjectId && s.Status == SprintStatus.Active, ct);
        var sprintBehind = false;
        if (sprint is not null)
        {
            var pts = await db.Tasks
                .Where(t => t.SprintId == sprint.Id)
                .Select(t => new { t.Status, Points = t.StoryPoints ?? 0 })
                .ToListAsync(ct);
            var total = pts.Sum(p => p.Points);
            var done = pts.Where(p => p.Status == DomainTaskStatus.Done).Sum(p => p.Points);
            var remaining = total - done;
            var days = Math.Max(1, (int)(sprint.EndDate.Date - sprint.StartDate.Date).TotalDays);
            var todayIdx = Math.Clamp((int)(today - sprint.StartDate.Date).TotalDays, 0, days);
            var ideal = total - (double)total / days * todayIdx;
            sprintBehind = remaining > ideal + 2;
        }

        var score = HealthScoreCalculator.Score(
            new HealthScoreCalculator.Inputs(blocked, openWithDue, overdue, inProgress, teamSize, sprintBehind));

        static string Tone(bool ok, bool warn) => ok ? "success" : warn ? "warning" : "danger";

        var onTrackPct = openWithDue > 0 ? Math.Round(100.0 * (openWithDue - overdue) / openWithDue) : 100;
        var wipPerDev = teamSize > 0 ? (double)inProgress / teamSize : inProgress;

        var signals = new List<HealthSignalDto>
        {
            new("Blockers", Tone(blocked == 0, blocked <= 2), blocked.ToString()),
            new("Overdue", Tone(overdue == 0, overdue <= 2), overdue.ToString()),
            new("On schedule", Tone(onTrackPct >= 90, onTrackPct >= 70), $"{onTrackPct:0}%"),
            new("WIP", Tone(wipPerDev <= 2, wipPerDev <= 4), wipPerDev <= 0 ? "0" : $"{wipPerDev:0.#}/dev"),
        };
        if (sprint is not null)
            signals.Add(new("Sprint pace", sprintBehind ? "warning" : "success", sprintBehind ? "behind" : "on track"));

        return Result.Success(new HealthDto(score, HealthScoreCalculator.Band(score), signals));
    }
}
