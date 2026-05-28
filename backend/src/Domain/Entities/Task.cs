using Domain.Enums;
using Domain.ValueObjects;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.Entities;

/// <summary>
/// A unit of work. Belongs to a Project; optionally grouped under an Epic
/// and/or assigned to a Sprint. Status changes go through
/// <see cref="ChangeStatus"/> so the state machine in
/// <see cref="TaskStatusTransition"/> is enforced from the domain layer.
/// Disambiguation note: this is Domain.Entities.Task, not
/// System.Threading.Tasks.Task — file scope uses a using-alias when both
/// are needed.
/// </summary>
public class Task
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    /// <summary>Per-project monotonically increasing serial. Combined with
    /// <see cref="Domain.Entities.Project.Key"/> to form the human-friendly
    /// display ID ("AT-247"). Assigned on create and never reused, even
    /// after the task is deleted.</summary>
    public int KeyNum { get; set; }
    public Guid? EpicId { get; set; }
    public Guid? SprintId { get; set; }
    /// <summary>Generic-project grouping (F1.5-06). Null when the task is
    /// unsorted, or for project types that don't surface lists (Engineering
    /// uses Epics, Sales uses Stages, etc.).</summary>
    public Guid? TaskListId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public int? StoryPoints { get; set; }
    public Priority Priority { get; set; } = Priority.Medium;
    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Backlog;
    public Guid? AssigneeId { get; set; }
    public Guid? ReviewerId { get; set; }
    public Guid? ReporterId { get; set; }
    public DateTime? DueDate { get; set; }
    public int PriorityOrder { get; set; }
    public string[] AcceptanceCriteria { get; set; } = [];
    public int TimeLoggedMinutes { get; set; }
    public string? PrUrl { get; set; }
    public bool CreatedByAi { get; set; }
    /// <summary>F2-22 — if the task was accepted from a meeting's
    /// action-item draft, this holds the source meeting id so the
    /// task drawer can render a "From meeting" affordance.</summary>
    public Guid? SourceMeetingId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public Epic? Epic { get; set; }
    public Sprint? Sprint { get; set; }
    public TaskList? TaskList { get; set; }
    public User? Assignee { get; set; }
    public User? Reviewer { get; set; }
    public User? Reporter { get; set; }
    public ICollection<Subtask> Subtasks { get; set; } = [];
    public ICollection<TaskStatusChange> StatusHistory { get; set; } = [];

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
