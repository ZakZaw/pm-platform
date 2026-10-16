using System.Globalization;
using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Roadmap.Queries;

/// <summary>
/// F1.5-08 — the type-aware roadmap timeline. Dispatches on the project's
/// <see cref="ProjectType"/> and returns one <see cref="ProjectTimelineDto"/>
/// shaped for that type (lanes of bars + markers), with a <c>Type</c> field so
/// the frontend registry picks the renderer:
/// <list type="bullet">
///   <item>Engineering — a lane per epic (bar + its pinned milestones), a Sprints lane.</item>
///   <item>Sales — a quarterly-target lane, then a lane per open stage with deals at their expected close.</item>
///   <item>Support — a lane per queue with open tickets at their SLA deadline (breach-flagged).</item>
///   <item>Marketing — a lane per campaign: its date span plus asset publish dates.</item>
///   <item>Operations — a lane per workflow with its runs (done / skipped / overdue / upcoming).</item>
///   <item>Generic — a lane per list with open tasks at their due date.</item>
/// </list>
/// All date maths, bucketing and tone rules live in the pure, unit-tested
/// <see cref="TimelineCalculator"/>. The engineering editing surface (epic
/// drag, dependencies, share links) stays on <see cref="GetProjectRoadmapQuery"/>.
/// </summary>
public record GetProjectTimelineQuery(Guid ProjectId) : IRequest<Result<ProjectTimelineDto>>;

public class GetProjectTimelineQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectTimelineQuery, Result<ProjectTimelineDto>>
{
    // Hard caps so a large project returns a bounded payload; markers are
    // taken nearest-first so the cap trims the far future, not today.
    private const int MaxMarkers = 300;
    private const int OpsLookbackDays = 30;
    private const int OpsLookaheadDays = 60;

    private sealed record Parts(
        List<TimelineGroupDto> Groups,
        List<TimelineBarDto> Bars,
        List<TimelineMarkerDto> Markers,
        List<TimelineStatDto> Stats,
        List<TimelineUndatedDto> Undated,
        string? Hint,
        // Window tuning per type: (padDays, fallbackBefore, fallbackAfter).
        (int Pad, int Before, int After) WindowTuning);

    public async Task<Result<ProjectTimelineDto>> Handle(GetProjectTimelineQuery request, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Type })
            .FirstOrDefaultAsync(ct);
        if (project is null) return Result.Failure<ProjectTimelineDto>(ProjectErrors.NotFound);

        var now = DateTime.UtcNow;
        var parts = project.Type switch
        {
            ProjectType.Sales => await SalesAsync(project.Id, now, ct),
            ProjectType.Support => await SupportAsync(project.Id, now, ct),
            ProjectType.Marketing => await MarketingAsync(project.Id, now, ct),
            ProjectType.Operations => await OperationsAsync(project.Id, now, ct),
            ProjectType.Generic => await GenericAsync(project.Id, now, ct),
            _ => await EngineeringAsync(project.Id, now, ct),
        };

        var dates = parts.Bars.SelectMany(b => new[] { b.Start, b.End })
            .Concat(parts.Markers.Select(m => m.At));
        var (from, to) = TimelineCalculator.Window(
            dates, now, parts.WindowTuning.Pad, parts.WindowTuning.Before, parts.WindowTuning.After);

        return Result.Success(new ProjectTimelineDto(
            project.Id,
            project.Type.ToString(),
            from,
            to,
            parts.Groups,
            parts.Bars,
            parts.Markers,
            parts.Stats,
            parts.Undated,
            parts.Hint));
    }

    // ---- Engineering ---------------------------------------------------

    private async Task<Parts> EngineeringAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var epics = await db.Epics
            .Where(e => e.ProjectId == projectId && e.ArchivedAt == null)
            .OrderBy(e => e.Order ?? int.MaxValue).ThenBy(e => e.StartDate).ThenBy(e => e.CreatedAt)
            .Select(e => new { e.Id, e.Title, e.Status, e.StartDate, e.EndDate, e.RiskFlag })
            .ToListAsync(ct);

        var sprints = await db.Sprints
            .Where(s => s.ProjectId == projectId)
            .OrderBy(s => s.StartDate)
            .Select(s => new { s.Id, s.Name, s.StartDate, s.EndDate, s.Status })
            .ToListAsync(ct);

        var milestones = await db.Milestones
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.Date)
            .Select(m => new { m.Id, m.Title, m.Date, m.EpicId })
            .ToListAsync(ct);

        var groups = new List<TimelineGroupDto>();
        var bars = new List<TimelineBarDto>();
        var dated = epics.Where(e => e.StartDate is not null && e.EndDate is not null).ToList();
        foreach (var (e, i) in dated.Select((e, i) => (e, i)))
        {
            var gid = e.Id.ToString();
            groups.Add(new TimelineGroupDto(gid, e.Title, e.Status.ToString()));
            bars.Add(new TimelineBarDto(
                gid, e.Title, ToDateTime(e.StartDate!.Value), ToDateTime(e.EndDate!.Value),
                e.Status == EpicStatus.Done ? "success" : TimelineCalculator.ToneForIndex(i),
                e.Status.ToString(), gid, e.RiskFlag));
        }

        if (sprints.Count > 0)
        {
            groups.Add(new TimelineGroupDto("sprints", "Sprints", $"{sprints.Count} total"));
            bars.AddRange(sprints.Select(s => new TimelineBarDto(
                s.Id.ToString(), s.Name, s.StartDate, s.EndDate,
                s.Status switch
                {
                    SprintStatus.Active => "accent",
                    SprintStatus.Closed => "neutral",
                    _ => "info",
                },
                s.Status.ToString(), "sprints", false)));
        }

        var datedIds = dated.Select(e => e.Id).ToHashSet();
        var markers = milestones.Select(m => new TimelineMarkerDto(
            m.Id.ToString(), m.Title, ToDateTime(m.Date), "accent", "milestone",
            null,
            m.EpicId is { } eid && datedIds.Contains(eid) ? eid.ToString() : null,
            false)).ToList();

        var undated = epics
            .Where(e => e.StartDate is null || e.EndDate is null)
            .Select(e => new TimelineUndatedDto(e.Id.ToString(), e.Title))
            .ToList();

        var active = sprints.FirstOrDefault(s => s.Status == SprintStatus.Active);
        var stats = new List<TimelineStatDto>
        {
            new("Epics placed", $"{dated.Count}/{epics.Count}", "info"),
            new("At risk", dated.Count(e => e.RiskFlag).ToString(CultureInfo.InvariantCulture),
                dated.Any(e => e.RiskFlag) ? "danger" : "neutral"),
            new("Active sprint", active?.Name ?? "—", active is null ? "neutral" : "accent"),
        };

        return new Parts(groups, bars, markers, stats, undated,
            bars.Count == 0
                ? "No epics placed on the timeline yet. Set start and end dates on an epic to see it here."
                : null,
            (14, 42, 42));
    }

    // ---- Sales ---------------------------------------------------------

    private async Task<Parts> SalesAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var stages = await db.DealStages
            .Where(s => s.ProjectId == projectId && !s.IsTerminalWon && !s.IsTerminalLost)
            .OrderBy(s => s.Order)
            .Select(s => new { s.Id, s.Name })
            .ToListAsync(ct);

        var deals = await db.Deals
            .Where(d => d.ProjectId == projectId && d.Status == DealStatus.Open)
            .Select(d => new { d.Id, d.Name, d.StageId, d.Value, d.Currency, d.Probability, d.ExpectedClose })
            .ToListAsync(ct);

        var currency = deals.Select(d => d.Currency).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? "USD";
        var stageIndex = stages.Select((s, i) => (s.Id, i)).ToDictionary(x => x.Id, x => x.i);
        var dated = deals
            .Where(d => d.ExpectedClose is not null)
            .OrderBy(d => Math.Abs((d.ExpectedClose!.Value - now).TotalDays))
            .Take(MaxMarkers)
            .ToList();

        var groups = new List<TimelineGroupDto>();
        var markers = new List<TimelineMarkerDto>();
        foreach (var (s, i) in stages.Select((s, i) => (s, i)))
        {
            var inStage = dated.Where(d => d.StageId == s.Id).ToList();
            if (inStage.Count == 0) continue;
            groups.Add(new TimelineGroupDto(
                s.Id.ToString(), s.Name, $"{inStage.Count} deal{(inStage.Count == 1 ? "" : "s")}"));
            foreach (var d in inStage)
            {
                var overdue = TimelineCalculator.IsCloseOverdue(d.ExpectedClose!.Value, now);
                markers.Add(new TimelineMarkerDto(
                    d.Id.ToString(), d.Name, d.ExpectedClose.Value,
                    overdue ? "danger" : TimelineCalculator.ToneForIndex(i),
                    "deal",
                    $"{Money(d.Value, d.Currency)} · {d.Probability}%{(overdue ? " · past close date" : "")}",
                    s.Id.ToString(), overdue));
            }
        }

        // Quarterly target lane: one bar per quarter spanning the deal window,
        // labelled with the open value expected to close inside it.
        var bars = new List<TimelineBarDto>();
        if (dated.Count > 0)
        {
            var (from, to) = TimelineCalculator.Window(dated.Select(d => d.ExpectedClose!.Value), now);
            var quarters = TimelineCalculator.Quarters(from, to);
            var totals = TimelineCalculator.QuarterTotals(
                dated.Select(d => (d.ExpectedClose!.Value, d.Value)), quarters);
            groups.Insert(0, new TimelineGroupDto("quarters", "Quarterly targets", "open value by close quarter"));
            bars.AddRange(totals.Select(t => new TimelineBarDto(
                $"q-{t.Quarter.Label.Replace(' ', '-')}",
                t.Quarter.Label,
                t.Quarter.Start,
                t.Quarter.End,
                now >= t.Quarter.Start && now < t.Quarter.End ? "accent" : "neutral",
                $"{t.Count} deal{(t.Count == 1 ? "" : "s")} · {Money(t.Value, currency)}",
                "quarters", false)));
        }

        var thisQuarter = TimelineCalculator.Quarters(now, now.AddDays(1)).FirstOrDefault();
        var closingThisQuarter = thisQuarter is null
            ? 0m
            : dated.Where(d => d.ExpectedClose >= thisQuarter.Start && d.ExpectedClose < thisQuarter.End)
                   .Sum(d => d.Value);
        var pastClose = dated.Count(d => TimelineCalculator.IsCloseOverdue(d.ExpectedClose!.Value, now));

        var stats = new List<TimelineStatDto>
        {
            new("Open pipeline", Money(deals.Sum(d => d.Value), currency), "info"),
            new("Closing this quarter", Money(closingThisQuarter, currency), "accent"),
            new("Past close date", pastClose.ToString(CultureInfo.InvariantCulture), pastClose > 0 ? "danger" : "neutral"),
        };

        var undated = deals
            .Where(d => d.ExpectedClose is null)
            .Select(d => new TimelineUndatedDto(d.Id.ToString(), d.Name))
            .ToList();

        return new Parts(groups, bars, markers, stats, undated,
            markers.Count == 0
                ? "Add expected close dates to open deals to see them on the quarterly timeline."
                : null,
            (7, 30, 150));
    }

    // ---- Support -------------------------------------------------------

    private async Task<Parts> SupportAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var queues = await db.Queues
            .Where(q => q.ProjectId == projectId)
            .OrderBy(q => q.Order)
            .Select(q => new { q.Id, q.Name, q.SlaMinutes })
            .ToListAsync(ct);

        var tickets = await db.Tickets
            .Where(t => t.ProjectId == projectId
                        && t.Status != TicketStatus.Resolved
                        && t.Status != TicketStatus.Closed)
            .OrderBy(t => t.SlaDueAt)
            .Take(MaxMarkers)
            .Select(t => new { t.Id, t.Subject, t.QueueId, t.SlaDueAt, t.Priority })
            .ToListAsync(ct);

        var groups = new List<TimelineGroupDto>();
        var markers = new List<TimelineMarkerDto>();
        foreach (var (q, i) in queues.Select((q, i) => (q, i)))
        {
            var inQueue = tickets.Where(t => t.QueueId == q.Id).ToList();
            groups.Add(new TimelineGroupDto(
                q.Id.ToString(), q.Name, $"{inQueue.Count} open · SLA {SlaLabel(q.SlaMinutes)}"));
            var laneTone = TimelineCalculator.ToneForIndex(i);
            foreach (var t in inQueue)
            {
                var (tone, flagged) = TimelineCalculator.SlaTone(t.SlaDueAt, now, laneTone);
                markers.Add(new TimelineMarkerDto(
                    t.Id.ToString(), t.Subject, t.SlaDueAt, tone, "sla",
                    $"{t.Priority} priority{(flagged ? " · SLA breached" : "")}",
                    q.Id.ToString(), flagged));
            }
        }

        var breached = markers.Count(m => m.Flagged);
        var dueSoon = tickets.Count(t => t.SlaDueAt >= now && t.SlaDueAt <= now.AddHours(24));
        var stats = new List<TimelineStatDto>
        {
            new("Open tickets", tickets.Count.ToString(CultureInfo.InvariantCulture), "info"),
            new("SLA breached", breached.ToString(CultureInfo.InvariantCulture), breached > 0 ? "danger" : "neutral"),
            new("Due in 24h", dueSoon.ToString(CultureInfo.InvariantCulture), dueSoon > 0 ? "warning" : "neutral"),
        };

        return new Parts(groups, [], markers, stats, [],
            markers.Count == 0
                ? "Open tickets with active SLAs will appear here as deadline markers, one lane per queue."
                : "Support work is a queue, not a plan — markers show SLA deadlines per queue.",
            (1, 1, 7));
    }

    // ---- Marketing -----------------------------------------------------

    private async Task<Parts> MarketingAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var campaigns = await db.Campaigns
            .Where(c => c.ProjectId == projectId && c.ArchivedAt == null && c.Status != CampaignStatus.Archived)
            .Select(c => new { c.Id, c.Name, c.Channel, c.Status, c.StartDate, c.EndDate, c.CreatedAt })
            .ToListAsync(ct);
        // Order in memory — undated campaigns sort last.
        campaigns = campaigns
            .OrderBy(c => c.StartDate is null).ThenBy(c => c.StartDate).ThenBy(c => c.CreatedAt)
            .ToList();

        var campaignIds = campaigns.Select(c => c.Id).ToList();
        var assets = await db.Assets
            .Where(a => campaignIds.Contains(a.CampaignId) && a.PublishDate != null && a.Status != AssetStatus.Archived)
            .OrderBy(a => a.PublishDate)
            .Take(MaxMarkers)
            .Select(a => new { a.Id, a.Title, a.Type, a.Status, a.CampaignId, PublishDate = a.PublishDate!.Value })
            .ToListAsync(ct);

        var groups = new List<TimelineGroupDto>();
        var bars = new List<TimelineBarDto>();
        var markers = new List<TimelineMarkerDto>();
        var undated = new List<TimelineUndatedDto>();
        foreach (var c in campaigns)
        {
            var gid = c.Id.ToString();
            var owned = assets.Where(a => a.CampaignId == c.Id).ToList();
            var hasSpan = c.StartDate is not null && c.EndDate is not null;
            if (!hasSpan) undated.Add(new TimelineUndatedDto(gid, c.Name));
            if (!hasSpan && owned.Count == 0) continue;

            groups.Add(new TimelineGroupDto(gid, c.Name, $"{c.Channel} · {c.Status}"));
            if (hasSpan)
                bars.Add(new TimelineBarDto(
                    gid, c.Name, c.StartDate!.Value, c.EndDate!.Value,
                    TimelineCalculator.ChannelTone(c.Channel),
                    $"{c.Channel} · {c.Status}", gid, false));
            foreach (var a in owned)
            {
                var (tone, flagged) = TimelineCalculator.AssetTone(a.Status, a.PublishDate, now);
                markers.Add(new TimelineMarkerDto(
                    a.Id.ToString(), a.Title, a.PublishDate, tone, "asset",
                    $"{a.Type} · {a.Status}{(flagged ? " · overdue" : "")}", gid, flagged));
            }
        }

        var active = campaigns.Count(c => c.Status == CampaignStatus.Active);
        var weekEnd = now.AddDays(7);
        var dueThisWeek = assets.Count(a => a.Status != AssetStatus.Published && a.PublishDate >= now && a.PublishDate <= weekEnd);
        var overdue = markers.Count(m => m.Flagged);
        var stats = new List<TimelineStatDto>
        {
            new("Active campaigns", active.ToString(CultureInfo.InvariantCulture), "info"),
            new("Publishing this week", dueThisWeek.ToString(CultureInfo.InvariantCulture), "accent"),
            new("Overdue assets", overdue.ToString(CultureInfo.InvariantCulture), overdue > 0 ? "danger" : "neutral"),
        };

        return new Parts(groups, bars, markers, stats, undated,
            groups.Count == 0
                ? "Add campaigns with start + end dates to see them as bars, with asset publish dates inside."
                : null,
            (7, 14, 90));
    }

    // ---- Operations ----------------------------------------------------

    private async Task<Parts> OperationsAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var workflows = await db.Workflows
            .Where(w => w.ProjectId == projectId && w.ArchivedAt == null)
            .OrderBy(w => w.Name)
            .Select(w => new { w.Id, w.Name, w.RecurrenceRule })
            .ToListAsync(ct);

        var lo = now.AddDays(-OpsLookbackDays);
        var hi = now.AddDays(OpsLookaheadDays);
        var runs = await db.WorkflowRuns
            .Where(r => r.Workflow.ProjectId == projectId
                        && r.Workflow.ArchivedAt == null
                        && r.ScheduledFor >= lo && r.ScheduledFor <= hi)
            .OrderBy(r => r.ScheduledFor)
            .Take(MaxMarkers)
            .Select(r => new { r.Id, r.WorkflowId, r.ScheduledFor, r.Status })
            .ToListAsync(ct);

        var groups = new List<TimelineGroupDto>();
        var markers = new List<TimelineMarkerDto>();
        foreach (var w in workflows)
        {
            var own = runs.Where(r => r.WorkflowId == w.Id).ToList();
            groups.Add(new TimelineGroupDto(
                w.Id.ToString(), w.Name,
                string.IsNullOrWhiteSpace(w.RecurrenceRule) ? "one-off" : "recurring"));
            foreach (var r in own)
            {
                var (tone, flagged) = TimelineCalculator.RunTone(r.Status, r.ScheduledFor, now);
                markers.Add(new TimelineMarkerDto(
                    r.Id.ToString(), w.Name, r.ScheduledFor, tone, "run",
                    flagged ? "overdue" : r.Status.ToString(), w.Id.ToString(), flagged));
            }
        }

        var overdue = markers.Count(m => m.Flagged);
        var next7 = runs.Count(r => r.Status is WorkflowRunStatus.Pending or WorkflowRunStatus.InProgress
                                    && r.ScheduledFor >= now && r.ScheduledFor <= now.AddDays(7));
        var done = runs.Count(r => r.Status == WorkflowRunStatus.Completed);
        var stats = new List<TimelineStatDto>
        {
            new("Runs next 7 days", next7.ToString(CultureInfo.InvariantCulture), "info"),
            new("Overdue runs", overdue.ToString(CultureInfo.InvariantCulture), overdue > 0 ? "danger" : "neutral"),
            new("Completed (30d)", done.ToString(CultureInfo.InvariantCulture), "success"),
        };

        return new Parts(groups, [], markers, stats, [],
            markers.Count == 0
                ? "Add workflows with a recurrence rule to see their scheduled runs here."
                : null,
            (3, 7, 30));
    }

    // ---- Generic -------------------------------------------------------

    private async Task<Parts> GenericAsync(Guid projectId, DateTime now, CancellationToken ct)
    {
        var lists = await db.TaskLists
            .Where(l => l.ProjectId == projectId)
            .OrderBy(l => l.Order)
            .Select(l => new { l.Id, l.Name })
            .ToListAsync(ct);

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == projectId
                        && t.DueDate != null
                        && t.Status != DomainTaskStatus.Done
                        && t.Status != DomainTaskStatus.WontDo)
            .OrderBy(t => t.DueDate)
            .Take(MaxMarkers)
            .Select(t => new { t.Id, t.Title, t.TaskListId, DueDate = t.DueDate!.Value, t.Status })
            .ToListAsync(ct);

        const string unsortedId = "unsorted";
        var lanes = lists.Select(l => (Id: (Guid?)l.Id, Key: l.Id.ToString(), l.Name)).ToList();
        if (tasks.Any(t => t.TaskListId is null || lists.All(l => l.Id != t.TaskListId)))
            lanes.Add((null, unsortedId, "Unsorted"));

        var groups = new List<TimelineGroupDto>();
        var markers = new List<TimelineMarkerDto>();
        foreach (var (lane, i) in lanes.Select((l, i) => (l, i)))
        {
            var own = lane.Id is { } lid
                ? tasks.Where(t => t.TaskListId == lid).ToList()
                : tasks.Where(t => t.TaskListId is null || lists.All(l => l.Id != t.TaskListId)).ToList();
            if (own.Count == 0) continue;
            groups.Add(new TimelineGroupDto(lane.Key, lane.Name, $"{own.Count} due"));
            foreach (var t in own)
            {
                var overdue = TimelineCalculator.IsTaskOverdue(t.DueDate, now);
                markers.Add(new TimelineMarkerDto(
                    t.Id.ToString(), t.Title, t.DueDate,
                    overdue ? "danger" : TimelineCalculator.ToneForIndex(i), "task",
                    overdue ? "overdue" : t.Status.ToString(), lane.Key, overdue));
            }
        }

        var overdueCount = markers.Count(m => m.Flagged);
        var dueWeek = tasks.Count(t => t.DueDate >= now.Date && t.DueDate <= now.AddDays(7));
        var stats = new List<TimelineStatDto>
        {
            new("Open with due date", tasks.Count.ToString(CultureInfo.InvariantCulture), "info"),
            new("Due this week", dueWeek.ToString(CultureInfo.InvariantCulture), "accent"),
            new("Overdue", overdueCount.ToString(CultureInfo.InvariantCulture), overdueCount > 0 ? "danger" : "neutral"),
        };

        return new Parts(groups, [], markers, stats, [],
            markers.Count == 0
                ? "Generic projects are list-shaped — add due dates to tasks to surface them here."
                : null,
            (3, 7, 30));
    }

    // ---- helpers -------------------------------------------------------

    private static DateTime ToDateTime(DateOnly d) => d.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    private static string Money(decimal value, string currency) =>
        $"{currency} {value.ToString("N0", CultureInfo.InvariantCulture)}";

    private static string SlaLabel(int minutes) =>
        minutes % (24 * 60) == 0 ? $"{minutes / (24 * 60)}d"
        : minutes % 60 == 0 ? $"{minutes / 60}h"
        : $"{minutes}m";
}
