using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Dashboard "weekly insight" (F3-18), computed on demand. Gathers the live
/// project signals — active-sprint pace, blockers, overdue work, the busiest
/// member — and lets the pure <see cref="WeeklyInsightCalculator"/> pick and
/// phrase the single most actionable observation. Replaces the sample card on
/// the engineering dashboard with real numbers and names.
/// </summary>
public record GetWeeklyInsightQuery(Guid ProjectId) : IRequest<Result<WeeklyInsightDto>>;

public class GetWeeklyInsightQueryHandler(IAppDbContext db)
    : IRequestHandler<GetWeeklyInsightQuery, Result<WeeklyInsightDto>>
{
    public async Task<Result<WeeklyInsightDto>> Handle(GetWeeklyInsightQuery request, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;

        if (!await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct))
            return Result.Failure<WeeklyInsightDto>(ProjectErrors.NotFound);

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId)
            .Select(t => new { t.Status, t.DueDate, t.StoryPoints, t.AssigneeId, t.Title, t.SprintId, t.CreatedAt })
            .ToListAsync(ct);

        static bool IsOpen(DomainTaskStatus s) =>
            s != DomainTaskStatus.Done && s != DomainTaskStatus.WontDo;

        var openTaskCount = tasks.Count(t => IsOpen(t.Status));
        var overdue = tasks.Count(t => IsOpen(t.Status) && t.DueDate != null && t.DueDate!.Value.Date < today);

        var blockedTasks = tasks.Where(t => t.Status == DomainTaskStatus.Blocked).ToList();
        var blockedPoints = blockedTasks.Sum(t => t.StoryPoints ?? 0);
        var topBlocker = blockedTasks
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => t.Title)
            .FirstOrDefault();

        // Busiest member by in-progress count — a load watch-out signal.
        var busiest = tasks
            .Where(t => t.Status == DomainTaskStatus.InProgress && t.AssigneeId != null)
            .GroupBy(t => t.AssigneeId!.Value)
            .Select(g => new { UserId = g.Key, Wip = g.Count() })
            .OrderByDescending(x => x.Wip)
            .FirstOrDefault();
        string? busiestName = null;
        var busiestWip = 0;
        if (busiest is not null)
        {
            busiestWip = busiest.Wip;
            busiestName = await db.Users
                .Where(u => u.Id == busiest.UserId)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(ct);
        }

        var sprint = await db.Sprints
            .Where(s => s.ProjectId == request.ProjectId && s.Status == SprintStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefaultAsync(ct);

        int committed = 0, done = 0, elapsed = 0, length = 0;
        if (sprint is not null)
        {
            var sprintTasks = tasks.Where(t => t.SprintId == sprint.Id).ToList();
            committed = sprintTasks.Sum(t => t.StoryPoints ?? 0);
            done = sprintTasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);
            length = Math.Max(1, (int)(sprint.EndDate.Date - sprint.StartDate.Date).TotalDays);
            elapsed = Math.Clamp((int)(today - sprint.StartDate.Date).TotalDays, 0, length);
        }

        var insight = WeeklyInsightCalculator.Compute(new WeeklyInsightCalculator.Inputs(
            HasActiveSprint: sprint is not null,
            SprintName: sprint?.Name,
            Committed: committed,
            DonePoints: done,
            ElapsedDays: elapsed,
            SprintLengthDays: length,
            BlockedPoints: blockedPoints,
            BlockedTaskCount: blockedTasks.Count,
            TopBlockerTitle: topBlocker,
            OverdueTaskCount: overdue,
            BusiestMemberName: busiestName,
            BusiestMemberWip: busiestWip,
            OpenTaskCount: openTaskCount));

        return Result.Success(new WeeklyInsightDto(
            insight.Headline, insight.Detail, insight.Tone, insight.Highlights));
    }
}
