namespace Application.Features.Analytics;

// Home-page aggregates (v1 "no sample data" pass). One payload per page:
// /home (personal), the project home, and the org home KPI strip (which rides
// on the org portfolio payload as OrgKpisDto).

// ---- Project home ----

/// <summary>A display-ready KPI tile. <see cref="DeltaGood"/> says whether the
/// delta is good news (green) or bad news (red); null when there's no delta.</summary>
public record HomeKpiTileDto(string Label, string Value, string? Sub, string? Delta, bool? DeltaGood);

/// <summary>The type-aware health card ("Sprint health", "Queue health", …).
/// <see cref="Tone"/> is a keyword (success/warning/danger/info).</summary>
public record HomeHealthNoteDto(string Title, string Headline, string Detail, string Tone, IReadOnlyList<string> Highlights);

public record ProjectHomeDto(string Type, IReadOnlyList<HomeKpiTileDto> Kpis, HomeHealthNoteDto Health);

// ---- Personal home (/home) ----

/// <summary>
/// The current user's headline numbers. Completions count tasks the user
/// finished (assignee, or the mover when unassigned), tickets they resolved and
/// ops runs they completed. Deltas compare against the previous 30 days and are
/// null when there's no baseline. Velocity is the user's own Done points per
/// sprint over the last 5 sprints they had work in.
/// </summary>
public record MyHomeKpisDto(
    int Completed30,
    int? CompletedDelta,
    double? AvgCycleDays,
    double? AvgCycleDeltaDays,
    int StreakDays,
    double? Velocity,
    double? VelocityDelta,
    int VelocitySprints);

/// <summary>One project the user belongs to, with their own open load there.</summary>
public record MyHomeProjectDto(
    Guid ProjectId,
    string Name,
    string Slug,
    string Key,
    string Type,
    string OrgSlug,
    int OpenItems,
    int OpenPoints,
    int Overdue,
    string Status,
    string StatusTone);

public record MyHomeDto(
    MyHomeKpisDto Kpis,
    IReadOnlyList<ThroughputWeekDto> Throughput,
    double? ThroughputChangePct,
    WeeklyInsightDto Insight,
    IReadOnlyList<MyHomeProjectDto> Projects);

// ---- Org home KPI strip (rides on OrgPortfolioDto) ----

/// <summary>
/// Org-level KPI strip. Each Has* flag says whether the org has any project of
/// that type, so the UI can render an empty state instead of a misleading 0.
/// Series are weekly, oldest first (8 weeks). Velocity is Done story points per
/// week across Engineering + Generic projects; pipeline and open-ticket series
/// are reconstructed from open/close timestamps.
/// </summary>
public record OrgKpisDto(
    int? PortfolioHealth,
    bool HasTaskProjects,
    double VelocityPerWeek,
    double? VelocityChangePct,
    IReadOnlyList<double> VelocitySeries,
    bool HasSales,
    string Currency,
    decimal PipelineValue,
    decimal WeightedForecast,
    IReadOnlyList<decimal> PipelineSeries,
    bool HasSupport,
    int OpenTickets,
    double? SlaAttainmentPct,
    IReadOnlyList<int> TicketSeries);
