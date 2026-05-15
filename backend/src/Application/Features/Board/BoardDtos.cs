namespace Application.Features.Board;

public record BoardCardDto(
    Guid StoryId,
    string Title,
    string Priority,
    string Status,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? EpicId,
    int TaskCount,
    int CompletedTaskCount);

public record BoardColumnDto(string Status, IReadOnlyList<BoardCardDto> Cards);

public record SwimlaneDto(string Key, string Label, IReadOnlyList<BoardColumnDto> Columns);

public record BoardDto(
    Guid ProjectId,
    Guid? SprintId,
    string? Swimlane,
    IReadOnlyList<SwimlaneDto> Swimlanes);

public record BacklogStoryDto(
    Guid Id,
    string Title,
    string Priority,
    string Status,
    int? StoryPoints,
    Guid? EpicId,
    Guid? AssigneeId,
    int PriorityOrder);
