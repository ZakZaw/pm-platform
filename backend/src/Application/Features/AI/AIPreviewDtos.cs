namespace Application.Features.AI;

public record AIGeneratedTaskDto(string Title, string Description);

public record AIGeneratedStoryDto(
    string Title,
    string Description,
    int StoryPoints,
    string Priority,
    IReadOnlyList<string> AcceptanceCriteria,
    IReadOnlyList<AIGeneratedTaskDto> Tasks);

public record AIGeneratedEpicDto(
    string Title,
    string Description,
    string? Color,
    IReadOnlyList<AIGeneratedStoryDto> Stories);

public record AIGenerationPreviewDto(
    Guid RequestId,
    string Provider,
    string Model,
    string SuggestedName,
    string EnvironmentType,
    IReadOnlyList<AIGeneratedEpicDto> Epics);

public record AIClarificationAnswerDto(string Question, string Answer);
