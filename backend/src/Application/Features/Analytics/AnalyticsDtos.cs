namespace Application.Features.Analytics;

// ---- Burndown (AN-01) ----

public record BurndownPointDto(int DayIndex, DateTime Date, double Ideal, double? Remaining);

/// <summary>
/// Sprint burndown payload. <see cref="SprintId"/> is null when the project
/// has no resolvable sprint (no active sprint and none requested) — the
/// dashboard renders an empty state rather than treating it as an error.
/// </summary>
public record BurndownDto(
    Guid? SprintId,
    string? SprintName,
    int TotalPoints,
    int Days,
    int TodayIndex,
    IReadOnlyList<BurndownPointDto> Points);

// ---- Velocity (AN-02) ----

public record VelocitySprintDto(
    Guid SprintId,
    string Name,
    int Committed,
    int Completed,
    double RollingAverage,
    bool Current);

public record VelocityDto(IReadOnlyList<VelocitySprintDto> Sprints);

// ---- Epic progress (AN-03) ----

public record EpicProgressDto(
    Guid EpicId,
    string Name,
    string? Color,
    int DonePoints,
    int TotalPoints,
    int DoneCount,
    int TotalCount);

public record EpicProgressResultDto(IReadOnlyList<EpicProgressDto> Epics);

// ---- Project health (F3-16, on-demand) ----

/// <summary>One component readout under the health gauge. <see cref="Tone"/>
/// is a keyword (success/warning/danger/info) the frontend maps to a token.</summary>
public record HealthSignalDto(string Label, string Tone, string Value);

public record HealthDto(int Score, string Band, IReadOnlyList<HealthSignalDto> Signals);

// ---- Headline KPIs ----

/// <summary>
/// Dashboard KPI strip. Percentage/duration fields are null when there is not
/// enough data to compute them (no dated tasks for on-track, no labelled tasks
/// for bug ratio, no completed work for cycle time) so the tile renders an em
/// dash rather than a misleading zero.
/// </summary>
public record ProjectKpisDto(int OpenTasks, double? OnTrackPct, double? BugRatioPct, double? AvgCycleDays);

// ---- Weekly insight (F3-18, computed) ----

/// <summary>
/// The dashboard "insight of the week" — a single, most-actionable observation
/// distilled from live project signals. <see cref="Tone"/> is a keyword
/// (success/warning/danger/info) the frontend maps to a token; <see
/// cref="Highlights"/> are short factual chips (e.g. "3 blocked"). This is the
/// deterministic, server-computed replacement for the old sample card — not the
/// LLM-narrated AI-Inbox suggestion (that lives in Features/AI).
/// </summary>
public record WeeklyInsightDto(string Headline, string Detail, string Tone, IReadOnlyList<string> Highlights);

// ---- Team workload (F3-14) ----

public record WorkloadMemberDto(Guid UserId, string Name, IReadOnlyList<int> Load);

/// <summary>Members × days heatmap. Each member's <c>Load</c> aligns index-wise
/// with <c>Days</c>; values are tasks that member moved to Done that day.</summary>
public record WorkloadDto(IReadOnlyList<string> Days, IReadOnlyList<WorkloadMemberDto> Members);
