using Domain.Enums;

namespace Domain.Entities;

public class Epic
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public Guid? OwnerId { get; set; }
    public EpicStatus Status { get; set; } = EpicStatus.Planning;
    public bool RiskFlag { get; set; }
    public ProjectType? Type { get; set; }
    public string? Color { get; set; }
    public bool CreatedByAi { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ArchivedAt { get; set; }

    // F2-01 roadmap timeline. Both nullable: a brand-new epic has no dates
    // until the PM places it on the roadmap. The Order column lets the PM
    // pin a manual lane order on the timeline; null means "auto by start
    // date".
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int? Order { get; set; }

    public Project Project { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<Task> Tasks { get; set; } = [];
    public ICollection<EpicDependency> DependsOn { get; set; } = [];
    public ICollection<EpicDependency> DependedOnBy { get; set; } = [];
}
