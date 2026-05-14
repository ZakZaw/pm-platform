using Domain.Enums;

namespace Domain.Entities;

public class Invitation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public required string Email { get; set; }
    public OrgRole Role { get; set; }
    public required string Token { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid CreatedById { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public Guid? AcceptedById { get; set; }

    public Organization Organization { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;

    public bool IsAccepted => AcceptedAt.HasValue;
    public bool IsExpired(DateTime nowUtc) => nowUtc >= ExpiresAt;

    public void MarkAccepted(Guid acceptingUserId, DateTime nowUtc)
    {
        AcceptedAt = nowUtc;
        AcceptedById = acceptingUserId;
    }
}
