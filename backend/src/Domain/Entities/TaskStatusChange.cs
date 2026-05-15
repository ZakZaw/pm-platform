using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.Entities;

/// <summary>
/// Append-only audit row written every time Task.ChangeStatus is called.
/// </summary>
public class TaskStatusChange
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public DomainTaskStatus FromStatus { get; set; }
    public DomainTaskStatus ToStatus { get; set; }
    public Guid ByUserId { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Task Task { get; set; } = null!;
    public User ByUser { get; set; } = null!;
}
