namespace Domain.Entities;

public class Subtask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public required string Title { get; set; }
    public bool Completed { get; set; }
    public Guid? AssigneeId { get; set; }
    public int Order { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Task Task { get; set; } = null!;
    public User? Assignee { get; set; }
}
