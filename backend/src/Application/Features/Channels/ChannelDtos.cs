namespace Application.Features.Channels;

/// <summary>
/// Summary row for the channel sidebar. <see cref="UnreadCount"/> is
/// the activity-since-last-read signal — for F2-16 it's a boolean
/// (0 or 1) because messages don't exist yet; once F2-18 lands the
/// query that produces this DTO can swap in a real count without
/// changing the wire shape.
/// </summary>
public record ChannelListItemDto(
    Guid Id,
    string Name,
    string Type,
    Guid? ProjectId,
    string? ProjectName,
    string? ProjectKey,
    Guid? TeamId,
    Guid? EpicId,
    string? EpicTitle,
    DateTime LastActivityAt,
    DateTime? LastReadAt,
    DateTime? ArchivedAt,
    int UnreadCount);

public record ChannelDetailDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string Type,
    Guid? ProjectId,
    string? ProjectName,
    string? ProjectSlug,
    Guid? TeamId,
    Guid? EpicId,
    string? EpicTitle,
    DateTime LastActivityAt,
    DateTime CreatedAt,
    DateTime? ArchivedAt,
    IReadOnlyList<ChannelMemberDto> Members);

public record ChannelMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string? AvatarUrl,
    DateTime JoinedAt,
    DateTime? LastReadAt);
