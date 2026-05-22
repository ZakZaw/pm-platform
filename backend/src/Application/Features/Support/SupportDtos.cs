namespace Application.Features.Support;

public record QueueDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    int Order,
    int SlaMinutes,
    Guid? DefaultAssigneeId,
    int OpenTicketCount,
    int BreachedTicketCount);

public record CustomerDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Email,
    string? Company,
    string? Tier,
    DateTime CreatedAt,
    int OpenTicketCount,
    int TotalTicketCount);

public record TicketDto(
    Guid Id,
    Guid ProjectId,
    Guid CustomerId,
    string CustomerName,
    string? CustomerTier,
    Guid QueueId,
    string QueueName,
    string Subject,
    string? BodyMd,
    string Status,
    string Priority,
    Guid? AssigneeId,
    DateTime OpenedAt,
    DateTime SlaDueAt,
    DateTime? FirstResponseAt,
    DateTime? ResolvedAt,
    DateTime? ClosedAt,
    int ReplyCount,
    bool IsBreached);

public record TicketReplyDto(
    Guid Id,
    Guid TicketId,
    Guid AuthorId,
    string BodyMd,
    bool IsInternal,
    DateTime CreatedAt,
    DateTime? EditedAt);

public record QueueViewDto(
    Guid Id,
    string Name,
    int Order,
    int SlaMinutes,
    int OpenCount,
    int BreachedCount,
    IReadOnlyList<TicketDto> Tickets);

public record QueueViewResponseDto(IReadOnlyList<QueueViewDto> Queues);
