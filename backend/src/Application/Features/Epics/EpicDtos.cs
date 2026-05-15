namespace Application.Features.Epics;

public record EpicDto(
    Guid Id,
    Guid ProjectId,
    string Title,
    string? Description,
    Guid? OwnerId,
    string Status,
    bool RiskFlag,
    string? EnvironmentType,
    string? Color,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    int StoryCount,
    int TotalStoryPoints,
    int DoneStoryPoints);
