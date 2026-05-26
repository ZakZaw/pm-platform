namespace Domain.Entities;

/// <summary>
/// A "this task cannot start until that one finishes" edge. Mirrors
/// <see cref="EpicDependency"/> for the task layer. Cycle detection reuses
/// the same pure helper (<see cref="EpicDependencyGraph.WouldCreateCycle"/>)
/// — the graph algorithm doesn't care which entity the GUIDs identify.
/// </summary>
public class TaskDependency
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The task that has a prerequisite.</summary>
    public Guid TaskId { get; set; }

    /// <summary>The task that must finish first.</summary>
    public Guid DependsOnTaskId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Task Task { get; set; } = null!;
    public Task DependsOnTask { get; set; } = null!;
}
