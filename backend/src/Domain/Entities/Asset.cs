using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A deliverable inside a Campaign — an email, blog post, ad creative,
/// social post, landing page, etc. <see cref="PublishDate"/> pins the
/// asset onto the content calendar and is what drag-reschedule on the
/// calendar updates. Rejection from Review back to Draft requires a
/// non-empty <see cref="RejectionReason"/> (AC for F1.5-04).
/// </summary>
public class Asset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CampaignId { get; set; }
    public AssetType Type { get; set; } = AssetType.Other;
    public required string Title { get; set; }
    public AssetStatus Status { get; set; } = AssetStatus.Draft;
    public DateTime? PublishDate { get; set; }
    public Guid? OwnerId { get; set; }
    public string? FileUrl { get; set; }
    public string? BodyMd { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Campaign Campaign { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<MarketingTask> Tasks { get; set; } = [];
}
