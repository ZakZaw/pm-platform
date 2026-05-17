namespace Application.Features.Users;

public record MyWorkItemDto(
    Guid Id,
    string Title,
    string? Description,
    string Status,
    string Priority,
    DateTime? DueDate,
    Guid ProjectId,
    string ProjectSlug,
    string ProjectName,
    bool ProjectIsPersonal,
    string? OrgSlug,
    Guid? SprintId,
    DateTime CreatedAt);
