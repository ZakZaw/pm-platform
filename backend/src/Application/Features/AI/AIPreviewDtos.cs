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
