using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A discrete piece of work attached to a Campaign and optionally to a
/// specific Asset (e.g. "draft launch email copy"). Lighter than the
/// engineering Task — no story points, no sprint, no epic — just the
/// fields a marketer needs to schedule and assign work inside a campaign.
/// </summary>
public class MarketingTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public Guid? AssetId { get; set; }
    public required string Title { get; set; }
    public MarketingTaskStatus Status { get; set; } = MarketingTaskStatus.ToDo;
    public Guid? AssigneeId { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Campaign Campaign { get; set; } = null!;
    public Asset? Asset { get; set; }
    public User? Assignee { get; set; }
}
