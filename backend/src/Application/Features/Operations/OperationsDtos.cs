namespace Application.Features.Operations;

public record ChecklistTemplateItemDto(string Title, int Order, bool Sequential);

public record WorkflowDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Description,
    string? RecurrenceRule,
    Guid? OwnerId,
    IReadOnlyList<ChecklistTemplateItemDto> Template,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    DateTime? NextRunAt,
    DateTime? LastCompletedAt,
    string? LastRunStatus,
    int PendingRunCount,
    int OverdueRunCount);

public record ChecklistItemDto(
    Guid Id,
    Guid RunId,
    string Title,
    bool Completed,
    Guid? CompletedBy,
    DateTime? CompletedAt,
    int Order,
    bool Sequential);

public record WorkflowRunDto(
    Guid Id,
    Guid WorkflowId,
    string WorkflowName,
    DateTime ScheduledFor,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    string Status,
    string? SkippedReason,
    Guid? OwnerId,
    int ItemCount,
    int CompletedItemCount,
    bool IsOverdue);

public record WorkflowRunDetailDto(
    WorkflowRunDto Run,
    IReadOnlyList<ChecklistItemDto> Items);
