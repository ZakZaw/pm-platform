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
