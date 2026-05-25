namespace Domain.Entities;

/// <summary>
/// A dated point on the project roadmap (launch, gate review, deadline).
/// Optionally pinned to an epic so the milestone visually anchors to that
/// lane on the timeline.
/// </summary>
public class Milestone
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Title { get; set; }
    public DateOnly Date { get; set; }
    public string? Color { get; set; }
    public Guid? EpicId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public Epic? Epic { get; set; }
}
