using Domain.Enums;

namespace Domain.Entities;

public class OrgMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    public OrgRole Role { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RemovedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User User { get; set; } = null!;

    public bool IsActive => RemovedAt is null;
}
