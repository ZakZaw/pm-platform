using Domain.Enums;

namespace Domain.Entities;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    public EnvironmentType EnvironmentType { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
    public DateTime? TargetDate { get; set; }
    public AIControlMode AIControlMode { get; set; } = AIControlMode.Suggest;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Organization Organization { get; set; } = null!;
    public ICollection<ProjectMembership> Memberships { get; set; } = [];
}
