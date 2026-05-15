namespace Application.Features.Stories;

public record StoryDto(
    Guid Id,
    Guid ProjectId,
    Guid? EpicId,
    string Title,
    string? Description,
    int? StoryPoints,
    string Priority,
    string Status,
    Guid? AssigneeId,
    Guid? ReporterId,
    DateTime? DueDate,
    int PriorityOrder,
    string[] AcceptanceCriteria,
    bool CreatedByAi,
    DateTime CreatedAt);
