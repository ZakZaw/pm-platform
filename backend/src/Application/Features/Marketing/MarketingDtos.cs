namespace Application.Features.Marketing;

public record CampaignDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    string Channel,
    DateTime? StartDate,
    DateTime? EndDate,
    string Status,
    string? GoalMd,
    decimal? BudgetAmount,
    string? BudgetCurrency,
    Guid? OwnerId,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    int AssetCount,
    int PublishedAssetCount,
    int TaskCount,
    int DoneTaskCount);

public record AssetDto(
    Guid Id,
    Guid CampaignId,
    string CampaignName,
    string Channel,
    string Type,
    string Title,
    string Status,
    DateTime? PublishDate,
    Guid? OwnerId,
    string? FileUrl,
    string? BodyMd,
    string? RejectionReason,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public record MarketingTaskDto(
    Guid Id,
    Guid CampaignId,
    string CampaignName,
    Guid? AssetId,
    string? AssetTitle,
    string Title,
    string Status,
    Guid? AssigneeId,
    DateTime? DueDate,
    DateTime CreatedAt);

public record CampaignDetailDto(
    CampaignDto Campaign,
    IReadOnlyList<AssetDto> Assets,
    IReadOnlyList<MarketingTaskDto> Tasks);

public record CalendarAssetDto(
    Guid Id,
    Guid CampaignId,
    string CampaignName,
    string Channel,
    string Type,
    string Title,
    string Status,
    DateTime PublishDate,
    Guid? OwnerId);

public record ContentCalendarDto(
    DateTime From,
    DateTime To,
    IReadOnlyList<CalendarAssetDto> Assets);
