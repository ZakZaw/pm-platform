using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// The personal /home dashboard aggregate for the current user, scoped to the
/// non-archived projects they are a member of. One call returns the KPI strip
/// (completions, cycle time, streak, personal velocity), the weekly throughput
/// series, a computed personal insight, and the per-project rows with the
/// user's own open load and an on-track status.
///
/// "Completed by me" means: tasks moved to Done that are assigned to me (or,
/// when unassigned, that I moved), tickets assigned to me that were resolved,
/// and ops runs I own that were completed. Story points / cycle time are
/// task-only — tickets and runs have no points.
/// </summary>
public record GetMyHomeQuery : IRequest<Result<MyHomeDto>>;

public class GetMyHomeQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyHomeQuery, Result<MyHomeDto>>
{
    private const int ThroughputWeeks = 12;
    private const int PeriodDays = 30;
    private const int VelocityWindow = 5;
    // Completion history we look back over: the throughput chart plus a margin.
    private const int HistoryDays = ThroughputWeeks * 7 + 7;

    public async Task<Result<MyHomeDto>> Handle(GetMyHomeQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } me)
            return Result.Failure<MyHomeDto>(AuthErrors.NotAuthenticated);

        var now = DateTime.UtcNow;
        var today = now.Date;
        var since = today.AddDays(-HistoryDays);
        var periodStart = now.AddDays(-PeriodDays);
        var prevStart = now.AddDays(-2 * PeriodDays);

        var projects = await db.ProjectMemberships
            .Where(m => m.UserId == me && m.Project.Status != ProjectStatus.Archived)
            .Select(m => new
            {
                m.Project.Id, m.Project.Name, m.Project.Slug, m.Project.Key, m.Project.Type,
                m.Project.IsPersonal,
                OrgSlug = m.Project.Organization != null ? m.Project.Organization.Slug : null,
            })
            .ToListAsync(ct);
        var projectIds = projects.Select(p => p.Id).ToList();

        // ---- Completions ----
        var taskDone = await db.TaskStatusChanges
            .Where(c => c.ToStatus == DomainTaskStatus.Done
                        && c.CreatedAt >= since
                        && projectIds.Contains(c.Task.ProjectId)
                        && c.Task.Status == DomainTaskStatus.Done
                        && (c.Task.AssigneeId == me || (c.Task.AssigneeId == null && c.ByUserId == me)))
            .Select(c => new { c.TaskId, c.CreatedAt })
            .ToListAsync(ct);
        // One completion per task, dated by its latest move to Done.
        var taskCompletions = taskDone
            .GroupBy(c => c.TaskId)
            .Select(g => (TaskId: g.Key, At: g.Max(c => c.CreatedAt)))
            .ToList();

        var ticketResolutions = await db.Tickets
            .Where(t => projectIds.Contains(t.ProjectId) && t.AssigneeId == me
                        && t.ResolvedAt != null && t.ResolvedAt >= since)
            .Select(t => t.ResolvedAt!.Value)
            .ToListAsync(ct);

        var runCompletions = await db.WorkflowRuns
            .Where(r => projectIds.Contains(r.Workflow.ProjectId) && r.OwnerId == me
                        && r.Status == WorkflowRunStatus.Completed
                        && r.CompletedAt != null && r.CompletedAt >= since)
            .Select(r => r.CompletedAt!.Value)
            .ToListAsync(ct);

        var completions = taskCompletions.Select(t => t.At)
            .Concat(ticketResolutions)
            .Concat(runCompletions)
            .ToList();

        var completed30 = completions.Count(d => d >= periodStart);
        var completedPrev30 = completions.Count(d => d >= prevStart && d < periodStart);
        int? completedDelta = completedPrev30 + completed30 > 0 ? completed30 - completedPrev30 : null;

        var throughput = ThroughputCalculator.Weekly(completions, now, ThroughputWeeks)
            .Select(w => new ThroughputWeekDto(w.WeekStart, w.Count))
            .ToList();
        // Last 4 complete weeks vs the 4 before them (the current week is partial).
        var complete = throughput.Take(ThroughputWeeks - 1).Select(w => (double)w.Count).ToList();
        var (recentAvg, prevAvg) = TrendCalculator.TrailingWindows(complete, 4);
        var throughputChange = recentAvg is { } ra && prevAvg is { } pa ? TrendCalculator.PercentChange(ra, pa) : null;

        var streak = PersonalPerformanceCalculator.CurrentStreak(completions, today);

        // ---- Cycle time (tasks): first InProgress → latest Done ----
        var recentTaskIds = taskCompletions.Where(t => t.At >= prevStart).Select(t => t.TaskId).ToList();
        var starts = await db.TaskStatusChanges
            .Where(c => recentTaskIds.Contains(c.TaskId) && c.ToStatus == DomainTaskStatus.InProgress)
            .GroupBy(c => c.TaskId)
            .Select(g => new { TaskId = g.Key, Start = g.Min(c => c.CreatedAt) })
            .ToDictionaryAsync(x => x.TaskId, x => x.Start, ct);
        List<(DateTime Start, DateTime End)> Spans(DateTime from, DateTime to) =>
            taskCompletions
                .Where(t => t.At >= from && t.At < to && starts.ContainsKey(t.TaskId))
                .Select(t => (starts[t.TaskId], t.At))
                .ToList();
        var cycle = CycleTimeCalculator.AverageDays(Spans(periodStart, now.AddSeconds(1)));
        var cyclePrev = CycleTimeCalculator.AverageDays(Spans(prevStart, periodStart));
        double? cycleDelta = cycle is { } c1 && cyclePrev is { } c0 ? Math.Round(c1 - c0, 1) : null;

        // ---- Personal velocity: my Done points per sprint, sprints I had work in ----
        var sprints = await db.Sprints
            .Where(s => projectIds.Contains(s.ProjectId)
                        && s.Status != SprintStatus.Planning
                        && db.Tasks.Any(t => t.SprintId == s.Id && t.AssigneeId == me))
            .OrderByDescending(s => s.StartDate)
            .Take(VelocityWindow * 2)
            .Select(s => new
            {
                s.StartDate,
                Points = db.Tasks
                    .Where(t => t.SprintId == s.Id && t.AssigneeId == me && t.Status == DomainTaskStatus.Done)
                    .Sum(t => (int?)t.StoryPoints) ?? 0,
            })
            .ToListAsync(ct);
        var velocitySeries = sprints.OrderBy(s => s.StartDate).Select(s => (double)s.Points).ToList();
        var (velocity, velocityPrev) = TrendCalculator.TrailingWindows(velocitySeries, VelocityWindow);
        double? velocityDelta = velocity is { } v1 && velocityPrev is { } v0 ? Math.Round(v1 - v0, 1) : null;

        // ---- My open load per project ----
        var load = projectIds.ToDictionary(id => id, _ => new Load());

        var openTasks = await db.Tasks
            .Where(t => projectIds.Contains(t.ProjectId) && t.AssigneeId == me
                        && t.Status != DomainTaskStatus.Done && t.Status != DomainTaskStatus.WontDo)
            .Select(t => new { t.ProjectId, t.Title, t.StoryPoints, t.DueDate, t.Status })
            .ToListAsync(ct);
        string? topOverdue = null;
        DateTime? topOverdueDue = null;
        foreach (var t in openTasks)
        {
            var l = load[t.ProjectId];
            l.Open++;
            l.Points += t.StoryPoints ?? 0;
            if (t.Status == DomainTaskStatus.Blocked) l.Blocked++;
            if (t.DueDate is { } due && due.Date < today)
            {
                l.Overdue++;
                if (topOverdueDue is null || due < topOverdueDue) { topOverdueDue = due; topOverdue = t.Title; }
            }
        }

        var openTickets = await db.Tickets
            .Where(t => projectIds.Contains(t.ProjectId) && t.AssigneeId == me
                        && t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed)
            .Select(t => new { t.ProjectId, t.SlaDueAt })
            .ToListAsync(ct);
        foreach (var t in openTickets)
        {
            var l = load[t.ProjectId];
            l.Open++;
            if (t.SlaDueAt < now) l.Overdue++;
        }

        var openRuns = await db.WorkflowRuns
            .Where(r => projectIds.Contains(r.Workflow.ProjectId) && r.OwnerId == me
                        && (r.Status == WorkflowRunStatus.Pending || r.Status == WorkflowRunStatus.InProgress))
            .Select(r => new { r.Workflow.ProjectId, r.ScheduledFor })
            .ToListAsync(ct);
        foreach (var r in openRuns)
        {
            var l = load[r.ProjectId];
            l.Open++;
            if (r.ScheduledFor.Date < today) l.Overdue++;
        }

        var openMarketing = await db.MarketingTasks
            .Where(mt => projectIds.Contains(mt.Campaign.ProjectId) && mt.AssigneeId == me
                         && mt.Status != MarketingTaskStatus.Done && mt.Status != MarketingTaskStatus.Cancelled)
            .Select(mt => new { mt.Campaign.ProjectId, mt.DueDate })
            .ToListAsync(ct);
        foreach (var mt in openMarketing)
        {
            var l = load[mt.ProjectId];
            l.Open++;
            if (mt.DueDate is { } due && due.Date < today) l.Overdue++;
        }

        var openDeals = await db.Deals
            .Where(d => projectIds.Contains(d.ProjectId) && d.OwnerId == me && d.Status == DealStatus.Open)
            .Select(d => new { d.ProjectId, d.ExpectedClose })
            .ToListAsync(ct);
        foreach (var d in openDeals)
        {
            var l = load[d.ProjectId];
            l.Open++;
            if (d.ExpectedClose is { } close && close.Date < today) l.Overdue++;
        }

        // Rows: org projects only (the personal project has no org route).
        var rows = projects
            .Where(p => !p.IsPersonal && p.OrgSlug is not null)
            .Select(p =>
            {
                var l = load[p.Id];
                var status = PersonalPerformanceCalculator.StatusFor(l.Open, l.Overdue, l.Blocked);
                return new MyHomeProjectDto(
                    p.Id, p.Name, p.Slug, p.Key, p.Type.ToString(), p.OrgSlug!,
                    l.Open, l.Points, l.Overdue, status.Label, status.Tone);
            })
            .OrderByDescending(r => r.OpenItems)
            .ThenBy(r => r.Name)
            .ToList();

        var insight = PersonalPerformanceCalculator.Insight(new(
            Completed30: completed30,
            CompletedPrev30: completedPrev30,
            OpenItems: load.Values.Sum(l => l.Open),
            OverdueItems: load.Values.Sum(l => l.Overdue),
            BlockedItems: load.Values.Sum(l => l.Blocked),
            TopOverdueTitle: topOverdue,
            StreakDays: streak,
            CycleDays: cycle,
            CyclePrevDays: cyclePrev));

        return Result.Success(new MyHomeDto(
            new MyHomeKpisDto(
                completed30, completedDelta, cycle, cycleDelta, streak,
                velocity, velocityDelta, Math.Min(VelocityWindow, velocitySeries.Count)),
            throughput,
            throughputChange,
            new WeeklyInsightDto(insight.Headline, insight.Detail, insight.Tone, insight.Highlights),
            rows));
    }

    private sealed class Load
    {
        public int Open;
        public int Points;
        public int Overdue;
        public int Blocked;
    }
}
