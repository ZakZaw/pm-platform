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

public record AIGenerationPreviewDto(
    Guid RequestId,
    string Provider,
    string Model,
    string SuggestedName,
    string EnvironmentType,
    IReadOnlyList<AIGeneratedEpicDto> Epics);

public record AIClarificationAnswerDto(string Question, string Answer);
