namespace Application.Features.Comments;

public record CommentAuthorDto(Guid Id, string FullName, string? AvatarUrl);

public record CommentDto(
    Guid Id,
    Guid TaskId,
    CommentAuthorDto Author,
    string BodyMd,
    IReadOnlyList<Guid> MentionedUserIds,
    DateTime CreatedAt,
    DateTime? EditedAt);

public record MentionableUserDto(
    Guid Id,
    string FullName,
    string Email,
    string? AvatarUrl);
