namespace Application.Features.Projects;

public record ProjectDto(
    Guid Id,
    Guid? OrganizationId,
    string? OrgSlug,
    string Name,
    string Slug,
    string Key,
    string Type,
    string Status,
    DateTime? TargetDate,
    string AIControlMode,
    Guid CreatedBy,
    DateTime CreatedAt,
    bool IsPersonal,
    // F2-01 — the calling user's role on this project. Null when computed
    // from a context where there is no user (server-side seeding, etc).
    // Frontend gates edit affordances on this; never trust the client for
    // authorization — the RequireProjectRole attribute is the source of
    // truth.
    string? MyRole);

public record ProjectSummary(
    Guid Id,
    string Name,
    string Slug,
    string Key,
    string Type,
    string Status,
    DateTime? TargetDate);
