namespace Domain.Entities;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string PasswordHash { get; set; }
    public required string FullName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrgMembership> OrgMemberships { get; set; } = [];
    public ICollection<ProjectMembership> ProjectMemberships { get; set; } = [];
    public ICollection<TeamMembership> TeamMemberships { get; set; } = [];
}
