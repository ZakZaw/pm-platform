using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Project-wide activity feed entry. One row per semantic action ("Maria
/// moved the Auth epic to next quarter", "Tom added milestone Beta launch").
/// Distinct from <see cref="Activity"/>, which is a sales-only deal touchpoint,
/// and from <see cref="AIAuditLog"/>, which records AI write actions for
/// 24h-undo.
/// </summary>
public class ActivityLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? OrgId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid ActorId { get; set; }
    public ActivityVerb Verb { get; set; }
    public required string TargetType { get; set; }
    public Guid TargetId { get; set; }
    public string? Summary { get; set; }
    public string? MetadataJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Organization? Org { get; set; }
    public Project? Project { get; set; }
    public User Actor { get; set; } = null!;
}
