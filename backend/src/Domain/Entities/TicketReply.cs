namespace Domain.Entities;

/// <summary>
/// A reply on a ticket. <see cref="IsInternal"/> distinguishes notes
/// the team writes to each other from messages sent back to the
/// customer. Customer-facing exports and the public-share endpoint
/// must filter out internal replies (AC for F1.5-03).
/// </summary>
public class TicketReply
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public Guid AuthorId { get; set; }
    public required string BodyMd { get; set; }
    public bool IsInternal { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EditedAt { get; set; }

    public Ticket Ticket { get; set; } = null!;
    public User? Author { get; set; }
}
