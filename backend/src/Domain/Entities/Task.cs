using Domain.Enums;
using Domain.ValueObjects;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.Entities;

/// <summary>
/// A unit of work owned by a Story. Status changes go through
/// <see cref="ChangeStatus"/> so the state machine in
/// <see cref="TaskStatusTransition"/> is enforced from the domain layer.
/// Disambiguation note: this is Domain.Entities.Task, not
/// System.Threading.Tasks.Task — file scope uses a using-alias when
/// both are needed.
/// </summary>
public class Task
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StoryId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Backlog;
    public Guid? AssigneeId { get; set; }
    public Guid? ReviewerId { get; set; }
    public Priority Priority { get; set; } = Priority.Medium;
    public int TimeLoggedMinutes { get; set; }
    public string? PrUrl { get; set; }
    public bool CreatedByAi { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Story Story { get; set; } = null!;
    public User? Assignee { get; set; }
    public User? Reviewer { get; set; }
    public ICollection<Subtask> Subtasks { get; set; } = [];
    public ICollection<TaskStatusChange> StatusHistory { get; set; } = [];

    /// <summary>
    /// Validates against the state machine and applies the new status.
    /// Returns the audit row so the caller can persist it.
    /// </summary>
    public TaskStatusChange ChangeStatus(DomainTaskStatus to, Guid byUserId, string? reason)
    {
        TaskStatusTransition.EnsureValid(Status, to, reason);
        var change = new TaskStatusChange
        {
            TaskId = Id,
            FromStatus = Status,
            ToStatus = to,
            ByUserId = byUserId,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim()
        };
        Status = to;
        return change;
    }
}
