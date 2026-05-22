namespace Domain.Entities;

/// <summary>
/// A single tick-box inside a <see cref="WorkflowRun"/>. Copied from the
/// run's parent <see cref="Workflow"/> template at materialisation time
/// so the historical run isn't disturbed by later template edits.
/// When <see cref="Sequential"/> is true, the UI prevents ticking item
/// N until items 0..N-1 are already complete.
/// </summary>
public class ChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RunId { get; set; }
    public required string Title { get; set; }
    public bool Completed { get; set; }
    public Guid? CompletedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int Order { get; set; }
    public bool Sequential { get; set; }

    public WorkflowRun Run { get; set; } = null!;
}
