namespace Application.Features.Sales;

public record DealStageDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    int Order,
    int DefaultProbability,
    bool IsTerminalWon,
    bool IsTerminalLost);

public record AccountDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Domain,
    string? Industry,
    Guid? OwnerId,
    string? Notes,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    int OpenDealCount,
    decimal OpenDealValue);

public record LeadDto(
    Guid Id,
    Guid ProjectId,
    Guid? AccountId,
    string Name,
    string? Email,
    string? Phone,
    string? Source,
    string Status,
    Guid? OwnerId,
    Guid? ConvertedDealId,
    DateTime CreatedAt,
    DateTime? ConvertedAt);

public record DealDto(
    Guid Id,
    Guid ProjectId,
    Guid AccountId,
    string AccountName,
    string Name,
    decimal Value,
    string Currency,
    Guid StageId,
    string StageName,
    int Probability,
    DateTime? ExpectedClose,
    Guid? OwnerId,
    string Status,
    string? LostReason,
    string? WonNote,
    DateTime CreatedAt,
    DateTime? ClosedAt);

public record ActivityDto(
    Guid Id,
    Guid DealId,
    string Type,
    string Summary,
    DateTime OccurredAt,
    Guid OwnerId,
    DateTime CreatedAt);

public record PipelineStageDto(
    Guid Id,
    string Name,
    int Order,
    int DefaultProbability,
    bool IsTerminalWon,
    bool IsTerminalLost,
    int DealCount,
    decimal TotalValue,
    IReadOnlyList<DealDto> Deals);

public record PipelineDto(IReadOnlyList<PipelineStageDto> Stages);
