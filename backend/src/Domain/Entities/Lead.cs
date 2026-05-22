using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// An unqualified prospect — a person who might or might not become a
/// deal. Once qualified, a lead is converted into a <see cref="Deal"/>
/// (and optionally an <see cref="Account"/> if not already linked).
/// </summary>
public class Lead
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid? AccountId { get; set; }
    public required string Name { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public LeadStatus Status { get; set; } = LeadStatus.New;
    public Guid? OwnerId { get; set; }
    public Guid? ConvertedDealId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ConvertedAt { get; set; }

    public Project Project { get; set; } = null!;
    public Account? Account { get; set; }
    public User? Owner { get; set; }
    public Deal? ConvertedDeal { get; set; }
}
