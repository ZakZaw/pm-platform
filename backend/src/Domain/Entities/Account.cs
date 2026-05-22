namespace Domain.Entities;

/// <summary>
/// A customer or prospective customer organisation, the Sales-type
/// counterpart to an Epic. Deals and Leads are scoped to an Account
/// (a Lead's account is optional until qualification).
/// </summary>
public class Account
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public string? Domain { get; set; }
    public string? Industry { get; set; }
    public Guid? OwnerId { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ArchivedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<Deal> Deals { get; set; } = [];
    public ICollection<Lead> Leads { get; set; } = [];
}
