namespace Domain.Entities;

/// <summary>
/// A recurring procedure in an Operations project — the "runbook" itself.
/// The recurrence rule (RFC 5545 RRULE-ish subset) drives when concrete
/// <see cref="WorkflowRun"/> rows get materialised. The checklist template
/// is stored as JSON; copied into per-run <see cref="ChecklistItem"/> rows
/// when a run is materialised so editing the template later doesn't
/// retroactively rewrite history.
/// </summary>
public class Workflow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    /// <summary>Subset of RFC 5545 RRULE. Today: FREQ=DAILY|WEEKLY|MONTHLY,
    /// optional INTERVAL=N. Parsed by <c>RecurrenceRuleHelper</c>.</summary>
    public string? RecurrenceRule { get; set; }
    public Guid? OwnerId { get; set; }
    /// <summary>JSON array of <c>{ title, order, sequential }</c> — the
    /// checklist that gets copied into each new run.</summary>
    public string TemplateJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ArchivedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<WorkflowRun> Runs { get; set; } = [];
}
