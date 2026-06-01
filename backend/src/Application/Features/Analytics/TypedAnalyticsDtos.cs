namespace Application.Features.Analytics;

// Per-type dashboard analytics (pre-Phase-3 polish D). One aggregate payload
// per project type, computed server-side, replacing the client-side
// derivations the typed dashboard widgets used to do over the list endpoints.
// Mirrors the engineering analytics shape: real numbers, recomputed on load.

// ---- Sales ----

public record SalesFunnelStageDto(string Name, int Count, decimal Value, double ConversionPct);

public record SalesDealAtRiskDto(
    Guid Id, string Name, string StageName, int Probability,
    decimal Value, string Currency, DateTime? ExpectedClose);

/// <summary>
/// Sales dashboard aggregate. <see cref="WeightedForecast"/> is the
/// probability-weighted open pipeline; won/lost reflect deals closed in the
/// trailing 90 days. <see cref="WinRatePct"/> is null until something closes.
/// </summary>
public record SalesAnalyticsDto(
    string Currency,
    decimal OpenPipelineValue,
    decimal WeightedForecast,
    decimal WonValue,
    int WonCount,
    int LostCount,
    double? WinRatePct,
    IReadOnlyList<SalesFunnelStageDto> Funnel,
    IReadOnlyList<SalesDealAtRiskDto> DealsAtRisk);

// ---- Support ----

public record SupportQueueDto(Guid QueueId, string Name, int OpenCount, int BreachedCount);

public record SupportBreachDto(Guid Id, string Subject, string QueueName, DateTime SlaDueAt);

/// <summary>
/// Support dashboard aggregate. <see cref="SlaAttainmentPct"/> is the share of
/// tickets resolved within SLA over the trailing 30 days (null when none
/// resolved); <see cref="BreachedOpenCount"/> is the live count of open tickets
/// already past their SLA.
/// </summary>
public record SupportAnalyticsDto(
    int OpenCount,
    int BreachedOpenCount,
    double? SlaAttainmentPct,
    int ResolvedCount,
    IReadOnlyList<SupportQueueDto> Queues,
    IReadOnlyList<SupportBreachDto> Breaches);

// ---- Marketing ----

public record ThroughputWeekDto(DateTime WeekStart, int Count);

public record MarketingCampaignDto(Guid Id, string Name, int AssetCount, int PublishedAssetCount);

public record MarketingChannelDto(string Channel, int Count);

public record MarketingAssetDueDto(Guid Id, string Title, DateTime? PublishDate);

/// <summary>
/// Marketing dashboard aggregate. <see cref="Throughput"/> is assets published
/// per week over the trailing 8 weeks (oldest first) for the sparkline; assets
/// are bucketed by their publish date.
/// </summary>
public record MarketingAnalyticsDto(
    int ActiveCampaignCount,
    int PublishedLast30,
    IReadOnlyList<ThroughputWeekDto> Throughput,
    IReadOnlyList<MarketingCampaignDto> ActiveCampaigns,
    IReadOnlyList<MarketingChannelDto> ChannelMix,
    IReadOnlyList<MarketingAssetDueDto> DueThisWeek);

// ---- Operations ----

public record OpsRunDto(Guid RunId, string WorkflowName, DateTime ScheduledFor);

/// <summary>
/// Operations dashboard aggregate. Completion / on-time / skip rates are
/// computed over runs scheduled in the trailing 30 days (<see cref="WindowTotal"/>);
/// upcoming + overdue lists are the live forward/backward view of pending runs.
/// </summary>
public record OperationsAnalyticsDto(
    int Next7DaysCount,
    int OverdueCount,
    double? CompletionPct,
    double? OnTimePct,
    double? SkipPct,
    int WindowTotal,
    IReadOnlyList<OpsRunDto> Upcoming,
    IReadOnlyList<OpsRunDto> Overdue);
