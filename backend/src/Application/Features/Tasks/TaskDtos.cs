namespace Application.Features.Tasks;

public record TaskDto(
    Guid Id,
    Guid StoryId,
    string Title,
    string? Description,
    string Status,
    Guid? AssigneeId,
    Guid? ReviewerId,
    string Priority,
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
