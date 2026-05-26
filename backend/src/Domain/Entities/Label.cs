namespace Domain.Entities;

/// <summary>
/// A reusable, project-scoped tag that can be attached to many tasks
/// (PM-19). Multi-select chips on the task form; rendered as colored
/// pills on cards.
/// </summary>
public class Label
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public required string Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public ICollection<TaskLabel> TaskLinks { get; set; } = [];
}
