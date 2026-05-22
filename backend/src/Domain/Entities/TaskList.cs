namespace Domain.Entities;

/// <summary>
/// Lightweight grouping for tasks in a Generic project — the counterpart
/// to an Epic in an Engineering project, minus the status, milestone, and
/// risk-tracking fields. A task may belong to a single list or sit
/// unsorted at the bottom of the page. Order is maintained per-project.
/// </summary>
public class TaskList
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public int Order { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public ICollection<Task> Tasks { get; set; } = [];
}
