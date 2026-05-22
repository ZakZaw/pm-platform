using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A touchpoint logged against a Deal (or in future, an Account / Lead).
/// Activities form the activity timeline rendered in DealDetail.
/// </summary>
public class Activity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DealId { get; set; }
    public ActivityType Type { get; set; } = ActivityType.Note;
    public required string Summary { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Deal Deal { get; set; } = null!;
    public User? Owner { get; set; }
}
