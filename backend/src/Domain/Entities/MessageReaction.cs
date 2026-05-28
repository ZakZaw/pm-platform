namespace Domain.Entities;

/// <summary>
/// One row per (message, user, emoji). Emoji is the shortcode string
/// (<c>":+1:"</c>, <c>":tada:"</c>) — we render it client-side. Toggle
/// semantics: if a row exists for the triple it's removed, otherwise
/// added.
/// </summary>
public class MessageReaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public required string Emoji { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
