namespace Domain.Entities;

/// <summary>
/// A grouping for tickets — usually by topic (Billing, Bugs, General)
/// or by team. Each queue has its own SLA target; a ticket's
/// <see cref="Ticket.SlaDueAt"/> is computed from
/// opened_at + queue.sla_minutes.
/// </summary>
public class Queue
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public int Order { get; set; }
    public int SlaMinutes { get; set; } = 24 * 60;
    public Guid? DefaultAssigneeId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public User? DefaultAssignee { get; set; }
    public ICollection<Ticket> Tickets { get; set; } = [];
}
