namespace Domain.Entities;

/// <summary>
/// A customer or end-user of the product the Support project covers.
/// Tickets are scoped to a customer; the customer page lists their
/// ticket history.
/// </summary>
public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public string? Email { get; set; }
    public string? Company { get; set; }
    public string? Tier { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public ICollection<Ticket> Tickets { get; set; } = [];
}
