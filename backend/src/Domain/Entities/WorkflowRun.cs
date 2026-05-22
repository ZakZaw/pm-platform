using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// A single occurrence of a <see cref="Workflow"/>. Materialised in advance
/// from the workflow's recurrence rule; status transitions
/// Pending → InProgress → Completed (or → Skipped from any non-terminal
/// state). Skipping requires a <see cref="SkippedReason"/>.
/// </summary>
public class WorkflowRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public WorkflowRunStatus Status { get; set; } = WorkflowRunStatus.Pending;
    public string? SkippedReason { get; set; }
    public Guid? OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Workflow Workflow { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<ChecklistItem> Items { get; set; } = [];
}
