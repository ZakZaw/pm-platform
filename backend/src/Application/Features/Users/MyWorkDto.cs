namespace Application.Features.Users;

public record MyWorkItemDto(
    Guid Id,
    Guid StoryId,
    string StoryTitle,
    string Title,
    string? Description,
    string Status,
    string Priority,
    DateTime? DueDate,
    Guid ProjectId,
    string ProjectSlug,
    string ProjectName,
    string OrgSlug,
    DateTime CreatedAt);
