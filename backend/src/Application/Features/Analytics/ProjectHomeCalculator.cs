namespace Application.Features.Analytics;

/// <summary>
/// Pure composition of the project home page: the four type-appropriate KPI
/// tiles and the type-appropriate health note, built from raw numbers the
/// <c>GetProjectHomeQuery</c> gathers. Every tile is a real metric the data
/// model supports — where the old mockup showed something we don't store
/// (quota, CSAT, reach, CTR, compliance controls, audits) a real metric of the
/// same flavour stands in. Null inputs render as an em dash, never a fake zero.
/// DB-free and unit-testable.
/// </summary>
public static class ProjectHomeCalculator
{
    public record Tile(string Label, string Value, string? Sub = null, string? Delta = null, bool? DeltaGood = null);

    public record Note(string Title, string Headline, string Detail, string Tone, IReadOnlyList<string> Highlights);

    private const string Dash = "—";

    // ---- Engineering ----

    public readonly record struct EngineeringInputs(
        string? SprintName,
        int? SprintDaysLeft,
        double? VelocityAvg,
        double? VelocityChangePct,
        int OpenBugs,
        int UrgentBugs,
        int OpenPrs,
        int FailingPrs);

    public static IReadOnlyList<Tile> Engineering(EngineeringInputs i) =>
    [
        new("Sprint", i.SprintName ?? Dash,
            i.SprintName is null ? "No active sprint" : $"{i.SprintDaysLeft ?? 0}d left"),
        new("Velocity", i.VelocityAvg is { } v ? $"{v:0.#}" : Dash,
            i.VelocityAvg is null ? "no closed sprints yet" : "pts/sprint · last 3",
            i.VelocityChangePct is { } vc ? DisplayFormat.Signed(vc, "%", "0") : null,
            i.VelocityChangePct is { } g ? g >= 0 : null),
        new("Bugs open", i.OpenBugs.ToString(),
            i.UrgentBugs > 0 ? $"{i.UrgentBugs} urgent" : "labelled bug / defect"),
        new("PRs open", i.OpenPrs.ToString(),
            i.FailingPrs > 0 ? $"{i.FailingPrs} failing CI" : "linked GitHub PRs"),
    ];

    // ---- Sales ----

    public readonly record struct SalesInputs(
        string Currency,
        decimal OpenPipeline,
        int OpenDeals,
        double? WinRatePct,
        int Won,
        int Lost,
        double? AvgCycleDays,
        decimal WeightedForecast);

    public static IReadOnlyList<Tile> Sales(SalesInputs i) =>
    [
        new("Pipeline", DisplayFormat.Money(i.OpenPipeline, i.Currency), $"{i.OpenDeals} open deal{Plural(i.OpenDeals)}"),
        new("Win rate", i.WinRatePct is { } w ? DisplayFormat.Pct(w) : Dash,
            i.Won + i.Lost > 0 ? $"{i.Won} won · {i.Lost} lost · 90d" : "nothing closed in 90d"),
        new("Avg cycle", i.AvgCycleDays is { } c ? $"{c:0.#}d" : Dash, "created → won · 90d"),
        // Substitutes "Quota": no quota target is stored, the weighted forecast is real.
        new("Forecast", DisplayFormat.Money(i.WeightedForecast, i.Currency), "probability-weighted"),
    ];

    // ---- Support ----

    public readonly record struct SupportInputs(
        int Open,
        int UrgentOpen,
        double? SlaAttainmentPct,
        int ResolvedLast30,
        int BreachedOpen,
        double? AvgFirstReplyHours);

    public static IReadOnlyList<Tile> Support(SupportInputs i) =>
    [
        new("Open", i.Open.ToString(), i.UrgentOpen > 0 ? $"{i.UrgentOpen} urgent" : "tickets"),
        new("SLA hit", i.SlaAttainmentPct is { } s ? DisplayFormat.Pct(s) : Dash,
            i.ResolvedLast30 > 0 ? $"{i.ResolvedLast30} resolved · 30d" : "nothing resolved in 30d"),
        // Substitutes "CSAT": no satisfaction survey data is stored.
        new("Breached", i.BreachedOpen.ToString(), "open past SLA"),
        new("Avg first reply", i.AvgFirstReplyHours is { } h ? DisplayFormat.Duration(h) : Dash, "last 30d · calendar time"),
    ];

    // ---- Marketing ----

    public readonly record struct MarketingInputs(
        int ActiveCampaigns,
        int PlanningCampaigns,
        int ScheduledNext30,
        int PublishedLast30,
        int PublishedPrev30,
        int InReview);

    public static IReadOnlyList<Tile> Marketing(MarketingInputs i)
    {
        var change = i.PublishedLast30 - i.PublishedPrev30;
        var hasBaseline = i.PublishedLast30 + i.PublishedPrev30 > 0;
        return
        [
            new("Campaigns", i.ActiveCampaigns.ToString(),
                i.PlanningCampaigns > 0 ? $"{i.PlanningCampaigns} in planning" : "active or planning"),
            new("Scheduled", i.ScheduledNext30.ToString(), "assets · next 30d"),
            // Substitutes "Reach": no audience/analytics data is stored; published output is.
            new("Published", i.PublishedLast30.ToString(), "assets · last 30d",
                hasBaseline ? DisplayFormat.Signed(change) : null,
                hasBaseline ? change >= 0 : null),
            // Substitutes "CTR": no click data is stored; the approval queue is.
            new("In review", i.InReview.ToString(), "assets awaiting approval"),
        ];
    }

    // ---- Operations ----

    public readonly record struct OperationsInputs(
        int ActiveRuns,
        int OverdueRuns,
        double? CompletionPct,
        int WindowTotal,
        DateTime? NextRunAt,
        string? NextRunName,
        double? AvgCycleHours,
        DateTime Now);

    public static IReadOnlyList<Tile> Operations(OperationsInputs i) =>
    [
        new("Active runs", i.ActiveRuns.ToString(), i.OverdueRuns > 0 ? $"{i.OverdueRuns} overdue" : "none overdue"),
        // Substitutes "Compliance": no controls are modelled; run completion is.
        new("Completion", i.CompletionPct is { } c ? DisplayFormat.Pct(c) : Dash,
            i.WindowTotal > 0 ? $"{i.WindowTotal} runs due · 30d" : "no runs due in 30d"),
        // Substitutes "Next audit": no audit calendar exists; the next scheduled run does.
        new("Next run", i.NextRunAt is { } n ? n.ToString("MMM d", System.Globalization.CultureInfo.InvariantCulture) : Dash,
            i.NextRunAt is { } at ? $"{i.NextRunName} · {DaysUntil(at, i.Now)}" : "nothing scheduled"),
        new("Avg cycle", i.AvgCycleHours is { } h ? DisplayFormat.Duration(h) : Dash, "start → complete · 30d"),
    ];

    // ---- Generic ----

    public readonly record struct GenericInputs(int Open, int InProgress, int DoneLast7, int Members);

    public static IReadOnlyList<Tile> Generic(GenericInputs i) =>
    [
        new("Open", i.Open.ToString(), "tasks"),
        new("In progress", i.InProgress.ToString(), "tasks"),
        new("Done", i.DoneLast7.ToString(), "last 7 days"),
        new("Members", i.Members.ToString(), "on this project"),
    ];

    // ---- Health notes for non-task project types ----
    // Engineering + Generic reuse WeeklyInsightCalculator (sprint / backlog signals).

    public static Note SalesNote(int openDeals, int atRiskDeals, int overdueCloses, double? winRatePct)
    {
        var highlights = Highlights((atRiskDeals, "at risk"), (overdueCloses, "past close date"));
        if (openDeals == 0)
            return new("Pipeline health", "No open deals", "The pipeline is empty — add deals to start forecasting.", "info", highlights);
        if (overdueCloses > 0)
            return new("Pipeline health", $"{overdueCloses} deal{Plural(overdueCloses)} past expected close",
                $"{overdueCloses} of {openDeals} open deal{Plural(openDeals)} slipped past {(overdueCloses == 1 ? "its" : "their")} expected close date. Update the date or close them out so the forecast stays honest.",
                "warning", highlights);
        if (atRiskDeals > 0)
            return new("Pipeline health", $"{atRiskDeals} deal{Plural(atRiskDeals)} at risk",
                $"{atRiskDeals} low-probability deal{Plural(atRiskDeals)} {(atRiskDeals == 1 ? "is" : "are")} due to close within two weeks.",
                "warning", highlights);
        var win = winRatePct is { } w ? $" Win rate over 90 days is {w:0}%." : "";
        return new("Pipeline health", "Pipeline is on track",
            $"{openDeals} open deal{Plural(openDeals)}, none past due or at risk.{win}", "success", highlights);
    }

    public static Note SupportNote(int open, int breached, int dueSoon, double? slaPct)
    {
        var highlights = Highlights((breached, "breached"), (dueSoon, "due within 4h"));
        if (open == 0)
            return new("Queue health", "Queue is clear", "No open tickets right now.", "success", highlights);
        if (breached > 0)
            return new("Queue health", $"{breached} ticket{Plural(breached)} past SLA",
                $"{breached} of {open} open ticket{Plural(open)} already breached {(breached == 1 ? "its" : "their")} SLA. Triage these before taking new work.",
                "danger", highlights);
        if (dueSoon > 0)
            return new("Queue health", $"{dueSoon} ticket{Plural(dueSoon)} approaching SLA",
                $"{dueSoon} ticket{Plural(dueSoon)} will breach within 4 hours if untouched.", "warning", highlights);
        var sla = slaPct is { } s ? $" SLA attainment over 30 days is {s:0}%." : "";
        return new("Queue health", "Queue is within SLA", $"{open} open ticket{Plural(open)}, none close to breaching.{sla}", "success", highlights);
    }

    public static Note MarketingNote(int overdueAssets, int dueThisWeek, int inReview, int activeCampaigns)
    {
        var highlights = Highlights((overdueAssets, "overdue"), (dueThisWeek, "due this week"), (inReview, "in review"));
        if (overdueAssets > 0)
            return new("Calendar health", $"{overdueAssets} asset{Plural(overdueAssets)} past publish date",
                $"{overdueAssets} unpublished asset{Plural(overdueAssets)} missed {(overdueAssets == 1 ? "its" : "their")} publish date. Reschedule or ship them to keep the calendar honest.",
                "warning", highlights);
        if (dueThisWeek > 0)
            return new("Calendar health", $"{dueThisWeek} asset{Plural(dueThisWeek)} due this week",
                inReview > 0
                    ? $"{dueThisWeek} asset{Plural(dueThisWeek)} publish in the next 7 days and {inReview} {(inReview == 1 ? "is" : "are")} waiting on approval."
                    : $"{dueThisWeek} asset{Plural(dueThisWeek)} publish in the next 7 days.",
                "info", highlights);
        if (activeCampaigns == 0)
            return new("Calendar health", "No active campaigns", "Plan a campaign to start filling the calendar.", "info", highlights);
        return new("Calendar health", "Calendar is on track",
            $"{activeCampaigns} active campaign{Plural(activeCampaigns)}, nothing overdue.", "success", highlights);
    }

    public static Note OperationsNote(int overdueRuns, int next7Days, double? completionPct)
    {
        var highlights = Highlights((overdueRuns, "overdue"), (next7Days, "due in 7d"));
        if (overdueRuns > 0)
            return new("Run health", $"{overdueRuns} run{Plural(overdueRuns)} overdue",
                $"{overdueRuns} scheduled run{Plural(overdueRuns)} passed {(overdueRuns == 1 ? "its" : "their")} date without completing. Complete or skip with a reason.",
                "danger", highlights);
        if (completionPct is { } c && c < 80)
            return new("Run health", $"Completion at {c:0}%",
                $"Only {c:0}% of runs due in the last 30 days were completed. Check which runbooks keep getting skipped.",
                "warning", highlights);
        if (next7Days == 0)
            return new("Run health", "Nothing due this week", "No runs are scheduled in the next 7 days.", "info", highlights);
        return new("Run health", "All runs on track",
            $"{next7Days} run{Plural(next7Days)} due in the next 7 days and nothing overdue.", "success", highlights);
    }

    private static IReadOnlyList<string> Highlights(params (int Count, string Label)[] items) =>
        items.Where(x => x.Count > 0).Select(x => $"{x.Count} {x.Label}").ToList();

    private static string DaysUntil(DateTime at, DateTime now)
    {
        var days = (int)(at.Date - now.Date).TotalDays;
        return days <= 0 ? "today" : days == 1 ? "tomorrow" : $"in {days}d";
    }

    private static string Plural(int n) => n == 1 ? "" : "s";
}
