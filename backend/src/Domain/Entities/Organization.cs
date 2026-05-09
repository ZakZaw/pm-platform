using Domain.Enums;

namespace Domain.Entities;

public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public string? LogoUrl { get; set; }
    public OrgPlan Plan { get; set; } = OrgPlan.Free;
    public bool SsoEnabled { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<OrgMembership> Memberships { get; set; } = [];
    public ICollection<Project> Projects { get; set; } = [];
    public ICollection<Team> Teams { get; set; } = [];
}
