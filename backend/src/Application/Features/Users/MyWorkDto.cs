namespace Application.Features.Users;

public record MyWorkItemDto(
    Guid Id,
    string Key,
    int KeyNum,
    string Title,
    string? Description,
    string Status,
    string Priority,
    int? StoryPoints,
    DateTime? DueDate,
    Guid ProjectId,
    string ProjectSlug,
    string ProjectName,
    string ProjectKey,
    bool ProjectIsPersonal,
    string? OrgSlug,
    Guid? SprintId,
    DateTime CreatedAt);
