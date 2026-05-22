using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A revenue opportunity tied to an Account. Moves through DealStages
/// freely until it reaches a terminal stage (Closed Won / Closed Lost),
/// which flips Status and requires a reason on the lost side. Probability
/// defaults from the stage but stays editable per deal.
/// </summary>
public class Deal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid AccountId { get; set; }
    public required string Name { get; set; }
    public decimal Value { get; set; }
    public string Currency { get; set; } = "USD";
    public Guid StageId { get; set; }
    public int Probability { get; set; }
    public DateTime? ExpectedClose { get; set; }
    public Guid? OwnerId { get; set; }
    public DealStatus Status { get; set; } = DealStatus.Open;
    public string? LostReason { get; set; }
    public string? WonNote { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }

    public Project Project { get; set; } = null!;
    public Account Account { get; set; } = null!;
    public DealStage Stage { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<Activity> Activities { get; set; } = [];
}
