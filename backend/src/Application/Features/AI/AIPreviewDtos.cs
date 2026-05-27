namespace Application.Features.AI;

public record AIGeneratedTaskDto(
    string Title,
    string Description,
    int StoryPoints,
    string Priority,
    IReadOnlyList<string> AcceptanceCriteria);

public record AIGeneratedEpicDto(
    string Title,
    string Description,
    string? Color,
    IReadOnlyList<AIGeneratedTaskDto> Tasks);

/// <summary>
/// Unified preview payload across all project types. For Engineering,
/// <see cref="Epics"/> is populated and the type-specific fields are
/// null. For the other types one of the type-specific fields is filled
/// and <see cref="Epics"/> is null. The wizard picks the renderer
/// based on <see cref="Type"/>.
/// </summary>
public record AIGenerationPreviewDto(
    Guid RequestId,
    string Provider,
    string Model,
    string SuggestedName,
    string Type,
    IReadOnlyList<AIGeneratedEpicDto>? Epics,
    AISalesProjectDraft? Sales = null,
    AISupportProjectDraft? Support = null,
    AIMarketingProjectDraft? Marketing = null,
    AIOperationsProjectDraft? Operations = null,
    AIGenericProjectDraft? Generic = null);

public record AIClarificationAnswerDto(string Question, string Answer);

// F2-14 — preview payload for "new feature request -> epic breakdown".
// Combines the AI-generated epic with a deterministic timeline impact
// projection so the user sees the cost of accepting before they pick
// "Add to backlog" or "Add to sprint X". The same AIGeneratedEpicDto
// also flows through apply-epic — only the wrapper is new.
public record AIEpicBreakdownPreviewDto(
    AIGeneratedEpicDto Epic,
    AITimelineImpactDto Impact);

public record AITimelineImpactDto(
    int AddedStoryPoints,
    int ProjectVelocityPointsPerSprint,
    int AverageSprintLengthDays,
    bool HasHistoricalVelocity,
    int EstimatedSprintsToComplete,
    int ProjectedShiftDays,
    IReadOnlyList<AISprintImpactDto> Sprints,
    IReadOnlyList<AIMilestoneImpactDto> Milestones);

public record AISprintImpactDto(
    Guid SprintId,
    string Name,
    string Status,
    DateTime StartDate,
    DateTime EndDate,
    int CommittedPoints,
    int TargetPoints,
    int RemainingCapacityPoints,
    int ProjectedOverflowPoints,
    bool WouldFit);

public record AIMilestoneImpactDto(
    Guid MilestoneId,
    string Title,
    DateOnly Date,
    int DaysUntil,
    int ProjectedShiftDays);
