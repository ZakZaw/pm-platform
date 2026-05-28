namespace Domain.Entities;

/// <summary>
/// A message posted in a <see cref="Channel"/>. Body is markdown;
/// embedded task cards are written as <c>[[task:KEY]]</c> inline tokens
/// (e.g. <c>[[task:AT-247]]</c>) and resolved client-side at render time.
///
/// Threads: a reply has <see cref="ParentMessageId"/> pointing at the
/// top-level message. We only support a single level of nesting — replies
/// to replies still attach to the same parent — which is what the AC
/// asks for and what every chat tool people are used to does.
///
/// Deletes are soft. We keep the row so reply counts and the threaded
/// view stay coherent; the UI substitutes a "(deleted)" placeholder.
/// </summary>
public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChannelId { get; set; }

    /// <summary>
    /// Null for top-level messages. Replies set this to the parent's
    /// <see cref="Id"/>; replies of replies collapse to the same parent.
    /// </summary>
    public Guid? ParentMessageId { get; set; }

    public Guid AuthorId { get; set; }
    public required string BodyMd { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public Channel Channel { get; set; } = null!;
    public Message? Parent { get; set; }
    public User Author { get; set; } = null!;
    public ICollection<MessageReaction> Reactions { get; set; } = [];
}
