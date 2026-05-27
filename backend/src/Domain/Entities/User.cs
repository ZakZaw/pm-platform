namespace Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string Timezone { get; set; } = "UTC";
    public string[] SkillTags { get; set; } = [];
    public int CapacityHoursPerWeek { get; set; } = 40;
    /// <summary>
    /// When set to a future timestamp, the user is treated as out of
    /// office. F2-13's reassignment scorer skips OOO candidates, and the
    /// profile-update path fires a "member unavailable" notification
    /// when this transitions from null/past to a future value.
    /// </summary>
    public DateTime? OutOfOfficeUntil { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrgMembership> OrgMemberships { get; set; } = [];
    public ICollection<ProjectMembership> ProjectMemberships { get; set; } = [];
    public ICollection<TeamMembership> TeamMemberships { get; set; } = [];
}
