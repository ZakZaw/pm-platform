namespace Application.Features.Tasks;

public record TaskDto(
    Guid Id,
    /// <summary>Human-friendly task ID like "AT-247" — composed from the
    /// project's Key prefix and the task's per-project KeyNum serial.</summary>
    string Key,
    int KeyNum,
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
    // F2-23 GitHub PR / CI metadata for the linked pull request.
    int? PrNumber,
    string? PrState,
    string? CiStatus,
    string? CiUrl,
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
