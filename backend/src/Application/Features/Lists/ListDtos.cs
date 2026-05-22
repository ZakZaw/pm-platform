namespace Application.Features.Lists;

public record TaskListDto(
    Guid Id,
    Guid ProjectId,
    string Name,
    int Order,
    DateTime CreatedAt,
    int TaskCount,
    int CompletedTaskCount);

public record ListedTaskDto(
    Guid Id,
    string Key,
    string Title,
    string Status,
    string Priority,
    Guid? AssigneeId,
    DateTime? DueDate,
    int? StoryPoints,
    int SubtaskCount,
    int CompletedSubtaskCount,
    DateTime CreatedAt);

/// <summary>Bucketed view of every task in a Generic project — one bucket
/// per list, plus an "unsorted" bucket for tasks that don't belong to any
/// list. Returned by the Lists page.</summary>
public record TaskListsViewDto(
    IReadOnlyList<TaskListBucketDto> Lists,
    IReadOnlyList<ListedTaskDto> Unsorted);

public record TaskListBucketDto(
    Guid Id,
    string Name,
    int Order,
    DateTime CreatedAt,
    IReadOnlyList<ListedTaskDto> Tasks);
