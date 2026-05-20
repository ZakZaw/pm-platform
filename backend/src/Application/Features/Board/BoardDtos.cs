namespace Application.Features.Board;

public record BoardCardDto(
    Guid TaskId,
    string Key,
    int KeyNum,
    string Title,
    string Priority,
    string Status,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? EpicId,
    Guid? SprintId,
    int SubtaskCount,
    int CompletedSubtaskCount);

public record BoardColumnDto(string Status, IReadOnlyList<BoardCardDto> Cards);

public record SwimlaneDto(string Key, string Label, IReadOnlyList<BoardColumnDto> Columns);

public record BoardDto(
    Guid ProjectId,
    Guid? SprintId,
    string? Swimlane,
    IReadOnlyList<SwimlaneDto> Swimlanes);

public record BacklogTaskDto(
    Guid Id,
    string Key,
    int KeyNum,
    string Title,
    string Priority,
    string Status,
    int? StoryPoints,
    Guid? EpicId,
    Guid? SprintId,
    Guid? AssigneeId,
    DateTime? DueDate,
    int PriorityOrder,
    int SubtaskCount,
    int CompletedSubtaskCount);

public record BacklogSprintSectionDto(
    Guid SprintId,
    string Name,
    string Status,
    DateTime StartDate,
    DateTime EndDate,
    int TotalPoints,
    int DonePoints,
    IReadOnlyList<BacklogTaskDto> Tasks);

public record BacklogDto(
    Guid ProjectId,
    IReadOnlyList<BacklogSprintSectionDto> Sprints,
    IReadOnlyList<BacklogTaskDto> Unassigned);
