using TaskEntity = Domain.Entities.Task;

namespace Domain.Entities;

/// <summary>
/// A comment on a <see cref="TaskEntity"/>. Body is markdown; mention IDs
/// are denormalised onto the row so notification dispatchers don't have
/// to re-parse the body every time. Mentions are parsed server-side from
/// the body and unioned with any client hint.
/// </summary>
public class Comment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid AuthorId { get; set; }
    public required string BodyMd { get; set; }
    public Guid[] MentionedUserIds { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    public TaskEntity Task { get; set; } = null!;
    public User Author { get; set; } = null!;
}
