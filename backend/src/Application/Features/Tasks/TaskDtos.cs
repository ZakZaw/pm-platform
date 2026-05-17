namespace Application.Features.Tasks;

public record TaskDto(
    Guid Id,
    Guid ProjectId,
    Guid? EpicId,
    Guid? SprintId,
    string Title,
    string? Description,
    string Status,
    string Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? ReviewerId,
    Guid? ReporterId,
    DateTime? DueDate,
    int PriorityOrder,
    string[] AcceptanceCriteria,
    int TimeLoggedMinutes,
    string? PrUrl,
    bool CreatedByAi,
    DateTime CreatedAt);

public record TaskStatusChangeDto(
    Guid Id,
    Guid TaskId,
    string FromStatus,
    string ToStatus,
    Guid ByUserId,
    string? Reason,
    DateTime CreatedAt);
