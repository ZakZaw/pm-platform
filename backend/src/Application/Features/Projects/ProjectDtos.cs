namespace Application.Features.Projects;

public record ProjectDto(
    Guid Id,
    Guid OrganizationId,
    string OrgSlug,
    string Name,
    string Slug,
    string EnvironmentType,
    string Status,
    DateTime? TargetDate,
    string AIControlMode,
    Guid CreatedBy,
    DateTime CreatedAt);

public record ProjectSummary(
    Guid Id,
    string Name,
    string Slug,
    string EnvironmentType,
    string Status,
    DateTime? TargetDate);
