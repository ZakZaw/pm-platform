using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A Marketing-project campaign — the top-level work item that groups a
/// set of Assets and MarketingTasks targeting a single channel + window.
/// Marketing's counterpart to an Engineering Epic. The campaign carries
/// its own goal, budget and date range; assets render under it on the
/// content calendar.
/// </summary>
public class Campaign
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public MarketingChannel Channel { get; set; } = MarketingChannel.Other;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Planning;
    public string? GoalMd { get; set; }
    public decimal? BudgetAmount { get; set; }
    public string? BudgetCurrency { get; set; }
    public Guid? OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ArchivedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<Asset> Assets { get; set; } = [];
    public ICollection<MarketingTask> Tasks { get; set; } = [];
}
