namespace Application.Features.Subtasks;

public record SubtaskDto(
    Guid Id,
    Guid TaskId,
    string Title,
    bool Completed,
    Guid? AssigneeId,
    int Order,
    DateTime CreatedAt);
