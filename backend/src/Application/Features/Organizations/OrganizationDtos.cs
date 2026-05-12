namespace Application.Features.Organizations;

public record OrganizationDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string Plan,
    bool SsoEnabled,
    DateTime CreatedAt);

public record OrgSummary(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string Role);
