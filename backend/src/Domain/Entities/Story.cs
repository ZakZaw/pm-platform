using Domain.Enums;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Domain.Entities;

public class Story
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid? EpicId { get; set; }
    public Guid? SprintId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public int? StoryPoints { get; set; }
    public Priority Priority { get; set; } = Priority.Medium;
    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Backlog;
    public Guid? AssigneeId { get; set; }
    public Guid? ReporterId { get; set; }
    public DateTime? DueDate { get; set; }
    public int PriorityOrder { get; set; }
    public string[] AcceptanceCriteria { get; set; } = [];
    public bool CreatedByAi { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public Epic? Epic { get; set; }
    public Sprint? Sprint { get; set; }
    public User? Assignee { get; set; }
    public User? Reporter { get; set; }
    public ICollection<Task> Tasks { get; set; } = [];
}
