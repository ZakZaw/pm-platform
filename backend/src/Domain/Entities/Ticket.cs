using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A support request from a Customer, sitting in a Queue. Status moves
/// through the lifecycle in <see cref="TicketStatus"/>; SlaDueAt is
/// recomputed when the queue or sla_minutes changes. Once resolved, the
/// SLA timer stops (the badge shows the elapsed time but no longer
/// counts down).
/// </summary>
public class Ticket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid CustomerId { get; set; }
    public Guid QueueId { get; set; }
    public required string Subject { get; set; }
    public string? BodyMd { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.New;
    public Priority Priority { get; set; } = Priority.Medium;
    public Guid? AssigneeId { get; set; }
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    public DateTime SlaDueAt { get; set; }
    public DateTime? FirstResponseAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public bool SlaBreachNotified { get; set; }

    public Project Project { get; set; } = null!;
    public Customer Customer { get; set; } = null!;
    public Queue Queue { get; set; } = null!;
    public User? Assignee { get; set; }
    public ICollection<TicketReply> Replies { get; set; } = [];
}
