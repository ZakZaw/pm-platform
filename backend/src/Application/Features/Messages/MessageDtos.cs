namespace Application.Features.Messages;

/// <summary>
/// A single chat message. <see cref="ReplyCount"/> and
/// <see cref="LastReplyAt"/> are populated for top-level messages and
/// drive the "X replies · last 2h ago" footer in the message list.
/// Replies (those with <see cref="ParentMessageId"/>) leave them as 0 /
/// null since we only support one level of nesting.
/// </summary>
public record MessageDto(
    Guid Id,
    Guid ChannelId,
    Guid? ParentMessageId,
    Guid AuthorId,
    string AuthorName,
    string AuthorEmail,
    string? AuthorAvatarUrl,
    string BodyMd,
    DateTime CreatedAt,
    DateTime? EditedAt,
    bool IsDeleted,
    int ReplyCount,
    DateTime? LastReplyAt,
    IReadOnlyList<ReactionGroupDto> Reactions);

/// <summary>
/// Reactions grouped per emoji. <see cref="UserIds"/> drives the "you
/// already reacted" highlight and powers the tooltip ("Aria, Theo and 3
/// others reacted with :+1:").
/// </summary>
public record ReactionGroupDto(
    string Emoji,
    int Count,
    IReadOnlyList<Guid> UserIds);
