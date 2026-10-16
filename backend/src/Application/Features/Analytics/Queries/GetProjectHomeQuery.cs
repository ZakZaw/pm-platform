using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Project home page aggregate: the four type-appropriate KPI tiles and the
/// type-aware health card, in one call. Reuses the per-type dashboard queries
/// (sales / support / operations analytics, velocity, weekly insight) for the
/// numbers they already compute and adds the few extra signals the tiles need;
/// <see cref="ProjectHomeCalculator"/> turns the numbers into display tiles.
/// </summary>
public record GetProjectHomeQuery(Guid ProjectId) : IRequest<Result<ProjectHomeDto>>;

public class GetProjectHomeQueryHandler(IAppDbContext db, ISender mediator)
    : IRequestHandler<GetProjectHomeQuery, Result<ProjectHomeDto>>
{
    private static readonly string[] BugLabelNames = ["bug", "defect"];
    private const int WindowDays = 30;
    private const int SalesWindowDays = 90;
    private const int VelocitySprints = 3;
    private const int SupportDueSoonHours = 4;

    public async Task<Result<ProjectHomeDto>> Handle(GetProjectHomeQuery request, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Type })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<ProjectHomeDto>(ProjectErrors.NotFound);

        var now = DateTime.UtcNow;
        var id = project.Id;

        (IReadOnlyList<ProjectHomeCalculator.Tile> Tiles, ProjectHomeCalculator.Note Note) home = project.Type switch
        {
            ProjectType.Sales => await Sales(id, now, ct),
            ProjectType.Support => await Support(id, now, ct),
            ProjectType.Marketing => await Marketing(id, now, ct),
            ProjectType.Operations => await Operations(id, now, ct),
            ProjectType.Generic => await Generic(id, now, ct),
            _ => await Engineering(id, now, ct),
        };

        return Result.Success(new ProjectHomeDto(
            project.Type.ToString(),
            home.Tiles.Select(t => new HomeKpiTileDto(t.Label, t.Value, t.Sub, t.Delta, t.DeltaGood)).ToList(),
            new HomeHealthNoteDto(home.Note.Title, home.Note.Headline, home.Note.Detail, home.Note.Tone, home.Note.Highlights)));
    }

    // ---- Engineering ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Engineering(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var sprint = await db.Sprints
            .Where(s => s.ProjectId == projectId && s.Status == SprintStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new { s.Name, s.EndDate })
            .FirstOrDefaultAsync(ct);

        // Velocity: mean completed points over the last few closed sprints,
        // with the change of the latest closed sprint against the ones before it.
        double? velocityAvg = null, velocityChange = null;
        var velocity = await mediator.Send(new GetVelocityQuery(projectId), ct);
        if (velocity.IsSuccess)
        {
            var closed = velocity.Value!.Sprints.Where(s => !s.Current).Select(s => (double)s.Completed).ToList();
            velocityAvg = TrendCalculator.Mean(closed.Skip(Math.Max(0, closed.Count - VelocitySprints)).ToList());
            if (closed.Count >= 2)
            {
                var before = closed.Take(closed.Count - 1).ToList();
                var baseline = TrendCalculator.Mean(before.Skip(Math.Max(0, before.Count - VelocitySprints)).ToList());
                velocityChange = baseline is { } b ? TrendCalculator.PercentChange(closed[^1], b) : null;
            }
        }

        var openBugs = await db.Tasks
            .Where(t => t.ProjectId == projectId
                        && t.Status != DomainTaskStatus.Done && t.Status != DomainTaskStatus.WontDo
                        && db.TaskLabels.Any(tl => tl.TaskId == t.Id && BugLabelNames.Contains(tl.Label.Name.ToLower())))
            .Select(t => t.Priority)
            .ToListAsync(ct);

        var openPrs = await db.Tasks
            .Where(t => t.ProjectId == projectId && t.PrState == PullRequestState.Open)
            .Select(t => t.CiStatus)
            .ToListAsync(ct);

        var tiles = ProjectHomeCalculator.Engineering(new(
            SprintName: sprint?.Name,
            SprintDaysLeft: sprint is null ? null : Math.Max(0, (int)Math.Ceiling((sprint.EndDate - now).TotalDays)),
            VelocityAvg: velocityAvg,
            VelocityChangePct: velocityChange,
            OpenBugs: openBugs.Count,
            UrgentBugs: openBugs.Count(p => p == Priority.Urgent),
            OpenPrs: openPrs.Count,
            FailingPrs: openPrs.Count(c => c == CiStatus.Failure)));

        return (tiles, await InsightNote(projectId, "Sprint health", ct));
    }

    // ---- Generic ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Generic(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var statuses = await db.Tasks
            .Where(t => t.ProjectId == projectId)
            .Select(t => t.Status)
            .ToListAsync(ct);

        var weekAgo = now.AddDays(-7);
        var doneLast7 = await db.TaskStatusChanges
            .Where(c => c.Task.ProjectId == projectId && c.ToStatus == DomainTaskStatus.Done
                        && c.CreatedAt >= weekAgo && c.Task.Status == DomainTaskStatus.Done)
            .Select(c => c.TaskId)
            .Distinct()
            .CountAsync(ct);

        var members = await db.ProjectMemberships.CountAsync(m => m.ProjectId == projectId, ct);

        var tiles = ProjectHomeCalculator.Generic(new(
            Open: statuses.Count(s => s != DomainTaskStatus.Done && s != DomainTaskStatus.WontDo),
            InProgress: statuses.Count(s => s == DomainTaskStatus.InProgress),
            DoneLast7: doneLast7,
            Members: members));

        return (tiles, await InsightNote(projectId, "List health", ct));
    }

    private async Task<ProjectHomeCalculator.Note> InsightNote(Guid projectId, string title, CancellationToken ct)
    {
        var insight = await mediator.Send(new GetWeeklyInsightQuery(projectId), ct);
        return insight.IsSuccess
            ? new(title, insight.Value!.Headline, insight.Value.Detail, insight.Value.Tone, insight.Value.Highlights)
            : new(title, "No signal yet", "Not enough project activity to summarise.", "info", []);
    }

    // ---- Sales ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Sales(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var analytics = await mediator.Send(new GetSalesAnalyticsQuery(projectId), ct);
        var a = analytics.Value!;

        var cutoff = now.AddDays(-SalesWindowDays);
        var deals = await db.Deals
            .Where(d => d.ProjectId == projectId
                        && (d.Status == DealStatus.Open || (d.Status == DealStatus.Won && d.ClosedAt >= cutoff)))
            .Select(d => new { d.Status, d.CreatedAt, d.ClosedAt, d.ExpectedClose })
            .ToListAsync(ct);

        var open = deals.Where(d => d.Status == DealStatus.Open).ToList();
        var wonCycle = CycleTimeCalculator.AverageDays(deals
            .Where(d => d.Status == DealStatus.Won && d.ClosedAt is not null)
            .Select(d => (d.CreatedAt, d.ClosedAt!.Value)));
        var overdueCloses = open.Count(d => d.ExpectedClose is { } c && c.Date < now.Date);

        var tiles = ProjectHomeCalculator.Sales(new(
            Currency: a.Currency,
            OpenPipeline: a.OpenPipelineValue,
            OpenDeals: open.Count,
            WinRatePct: a.WinRatePct,
            Won: a.WonCount,
            Lost: a.LostCount,
            AvgCycleDays: wonCycle,
            WeightedForecast: a.WeightedForecast));

        return (tiles, ProjectHomeCalculator.SalesNote(open.Count, a.DealsAtRisk.Count, overdueCloses, a.WinRatePct));
    }

    // ---- Support ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Support(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var analytics = await mediator.Send(new GetSupportAnalyticsQuery(projectId), ct);
        var a = analytics.Value!;

        var open = await db.Tickets
            .Where(t => t.ProjectId == projectId
                        && t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed)
            .Select(t => new { t.Priority, t.SlaDueAt })
            .ToListAsync(ct);

        var since = now.AddDays(-WindowDays);
        var replies = await db.Tickets
            .Where(t => t.ProjectId == projectId && t.OpenedAt >= since && t.FirstResponseAt != null)
            .Select(t => new { t.OpenedAt, FirstResponseAt = t.FirstResponseAt!.Value })
            .ToListAsync(ct);
        var avgFirstReplyHours = CycleTimeCalculator.AverageHours(
            replies.Select(r => (r.OpenedAt, r.FirstResponseAt)));

        var dueSoonCutoff = now.AddHours(SupportDueSoonHours);
        var dueSoon = open.Count(t => t.SlaDueAt >= now && t.SlaDueAt <= dueSoonCutoff);

        var tiles = ProjectHomeCalculator.Support(new(
            Open: a.OpenCount,
            UrgentOpen: open.Count(t => t.Priority == Priority.Urgent),
            SlaAttainmentPct: a.SlaAttainmentPct,
            ResolvedLast30: a.ResolvedCount,
            BreachedOpen: a.BreachedOpenCount,
            AvgFirstReplyHours: avgFirstReplyHours));

        return (tiles, ProjectHomeCalculator.SupportNote(a.OpenCount, a.BreachedOpenCount, dueSoon, a.SlaAttainmentPct));
    }

    // ---- Marketing ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Marketing(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var campaigns = await db.Campaigns
            .Where(c => c.ProjectId == projectId && c.ArchivedAt == null)
            .Select(c => c.Status)
            .ToListAsync(ct);

        var assets = await db.Assets
            .Where(a => a.Campaign.ProjectId == projectId && a.Status != AssetStatus.Archived)
            .Select(a => new { a.Status, a.PublishDate })
            .ToListAsync(ct);

        var in30 = now.AddDays(WindowDays);
        var in7 = now.AddDays(7);
        var ago30 = now.AddDays(-WindowDays);
        var ago60 = now.AddDays(-2 * WindowDays);

        var unpublished = assets.Where(a => a.Status != AssetStatus.Published).ToList();
        var published = assets
            .Where(a => a.Status == AssetStatus.Published && a.PublishDate is not null)
            .Select(a => a.PublishDate!.Value)
            .ToList();

        var active = campaigns.Count(s => s is CampaignStatus.Active or CampaignStatus.Planning);
        var inReview = assets.Count(a => a.Status == AssetStatus.Review);

        var tiles = ProjectHomeCalculator.Marketing(new(
            ActiveCampaigns: active,
            PlanningCampaigns: campaigns.Count(s => s == CampaignStatus.Planning),
            ScheduledNext30: unpublished.Count(a => a.PublishDate is { } d && d >= now && d <= in30),
            PublishedLast30: published.Count(d => d >= ago30 && d <= now),
            PublishedPrev30: published.Count(d => d >= ago60 && d < ago30),
            InReview: inReview));

        var note = ProjectHomeCalculator.MarketingNote(
            overdueAssets: unpublished.Count(a => a.PublishDate is { } d && d < now),
            dueThisWeek: unpublished.Count(a => a.PublishDate is { } d && d >= now && d <= in7),
            inReview: inReview,
            activeCampaigns: active);

        return (tiles, note);
    }

    // ---- Operations ----

    private async Task<(IReadOnlyList<ProjectHomeCalculator.Tile>, ProjectHomeCalculator.Note)> Operations(
        Guid projectId, DateTime now, CancellationToken ct)
    {
        var analytics = await mediator.Send(new GetOperationsAnalyticsQuery(projectId), ct);
        var a = analytics.Value!;

        var active = await db.WorkflowRuns
            .Where(r => r.Workflow.ProjectId == projectId
                        && (r.Status == WorkflowRunStatus.Pending || r.Status == WorkflowRunStatus.InProgress))
            .Select(r => new { r.ScheduledFor, r.Workflow.Name })
            .ToListAsync(ct);
        var next = active.Where(r => r.ScheduledFor >= now).OrderBy(r => r.ScheduledFor).FirstOrDefault();

        var since = now.AddDays(-WindowDays);
        var spans = await db.WorkflowRuns
            .Where(r => r.Workflow.ProjectId == projectId && r.Status == WorkflowRunStatus.Completed
                        && r.StartedAt != null && r.CompletedAt != null && r.CompletedAt >= since)
            .Select(r => new { Start = r.StartedAt!.Value, End = r.CompletedAt!.Value })
            .ToListAsync(ct);
        // Runs are often same-day, so the average is kept in hours for a compact tile.
        var avgCycleHours = CycleTimeCalculator.AverageHours(spans.Select(s => (s.Start, s.End)));

        var tiles = ProjectHomeCalculator.Operations(new(
            ActiveRuns: active.Count,
            OverdueRuns: a.OverdueCount,
            CompletionPct: a.CompletionPct,
            WindowTotal: a.WindowTotal,
            NextRunAt: next?.ScheduledFor,
            NextRunName: next?.Name,
            AvgCycleHours: avgCycleHours,
            Now: now));

        return (tiles, ProjectHomeCalculator.OperationsNote(a.OverdueCount, a.Next7DaysCount, a.CompletionPct));
    }
}
