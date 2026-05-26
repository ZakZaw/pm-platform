namespace Domain.Entities;

/// <summary>
/// One logged time entry against a task (PM-20). The aggregate
/// <c>Task.TimeLoggedMinutes</c> stays the canonical sum for fast card-
/// level reads; this entity is the audit trail of who logged what when.
/// </summary>
public class TimeLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public int Minutes { get; set; }
    public DateTime LoggedAt { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Task Task { get; set; } = null!;
    public User User { get; set; } = null!;
}
