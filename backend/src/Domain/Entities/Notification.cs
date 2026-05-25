using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// One row per in-app notification delivered to a user's inbox. The actor is
/// optional — system-generated notifications (e.g. nightly digest) have none.
/// </summary>
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid OrgId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? ActorId { get; set; }
    public NotificationKind Kind { get; set; }
    public required string Title { get; set; }
    public string? BodyMd { get; set; }
    public string? LinkUrl { get; set; }
    public Guid? TargetId { get; set; }
    public string? TargetType { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Organization Org { get; set; } = null!;
    public Project? Project { get; set; }
    public User? Actor { get; set; }
}
