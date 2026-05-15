using Domain.Enums;

namespace Domain.Entities;

public class Sprint
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public string? Goal { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int? VelocityTarget { get; set; }
    public SprintStatus Status { get; set; } = SprintStatus.Planning;

    /// <summary>JSON-encoded snapshot of stories+points at start. Captures
    /// the "scope baseline" required by F1-12 so mid-sprint scope changes
    /// can be measured against the original plan.</summary>
    public string? ScopeBaselineJson { get; set; }

    /// <summary>Final velocity at close (sum of completed story points).</summary>
    public int? FinalVelocity { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ClosedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ICollection<Story> Stories { get; set; } = [];
}
