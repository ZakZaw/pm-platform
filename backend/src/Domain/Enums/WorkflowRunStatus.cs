namespace Domain.Enums;

/// <summary>
/// Lifecycle of a single scheduled execution of a recurring workflow.
/// Pending — materialised but not started yet (the next-scheduled instance).
/// InProgress — started by an owner; some checklist items may already be ticked.
/// Completed — last checklist item ticked, or explicitly completed.
/// Skipped — the owner decided not to run this occurrence; reason recorded.
/// </summary>
public enum WorkflowRunStatus
{
    Pending,
    InProgress,
    Completed,
    Skipped
}
