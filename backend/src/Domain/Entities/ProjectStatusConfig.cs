using Domain.Enums;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.Entities;

/// <summary>
/// Per-project overlay for the core <see cref="DomainTaskStatus"/> enum.
/// Stores display label, color, ordering, visibility, and whether the
/// status represents a "done" state — so PMs can customise board columns
/// without us having to invent fully-custom statuses (which would break
/// the domain state machine). One row per core enum value per project,
/// auto-seeded on first read.
/// </summary>
public class ProjectStatusConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public DomainTaskStatus Status { get; set; }
    public required string DisplayName { get; set; }
    public required string Color { get; set; }
    public int OrderIndex { get; set; }
    public bool IsDoneState { get; set; }
    public bool IsVisible { get; set; } = true;
    /// <summary>PM-21 WIP limit. Null = no limit. The board shows a
    /// warning ring on the column when current task count exceeds this.
    /// Status-machine enforcement isn't applied — limits are advisory.
    /// </summary>
    public int? WipLimit { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
}
