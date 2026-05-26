namespace Domain.Entities;

/// <summary>
/// A public, no-auth read-only window onto a project's roadmap. The token
/// is the URL segment; an optional bcrypt password gate adds a second
/// factor. Toggles let the link owner hide internal labels (epic
/// descriptions, risk flags) and assignee identities before sharing
/// externally.
/// </summary>
public class RoadmapShareLink
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Token { get; set; }
    public string? PasswordHash { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool HideInternalLabels { get; set; }
    public bool HideAssignees { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;
}
