using Domain.Enums;

namespace Domain.Entities;

public class Project
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? OrganizationId { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    /// <summary>2–4 char prefix used to compose human-friendly task IDs
    /// like "AT-247". Unique within an organization (or globally unique
    /// for personal projects). Derived from <see cref="Name"/> at create
    /// time and never changes — task IDs reference it permanently.</summary>
    public required string Key { get; set; }
    public EnvironmentType EnvironmentType { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Active;
    public DateTime? TargetDate { get; set; }
    public AIControlMode AIControlMode { get; set; } = AIControlMode.Suggest;
    public Guid CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>True when this is a user's private "Personal" project,
    /// auto-provisioned at register. Personal projects are hidden from
    /// normal project lists and only their owner can see/use them.</summary>
    public bool IsPersonal { get; set; }
    public Guid? OwnerUserId { get; set; }

    public Organization? Organization { get; set; }
    public User? OwnerUser { get; set; }
    public ICollection<ProjectMembership> Memberships { get; set; } = [];
    public ICollection<Epic> Epics { get; set; } = [];
    public ICollection<Sprint> Sprints { get; set; } = [];
    public ICollection<Task> Tasks { get; set; } = [];
}
