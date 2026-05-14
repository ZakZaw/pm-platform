namespace Application.Features.Invitations;

public record InvitationDto(
    Guid Id,
    string Email,
    string Role,
    DateTime ExpiresAt,
    DateTime CreatedAt);

// Returned by GetInvitationByToken (public preview) so AcceptInvitePage can
// render org/role context before authentication. Token is never echoed back.
public record InvitationPreviewDto(
    string Email,
    string Role,
    string OrganizationName,
    string OrganizationSlug,
    string InviterFullName,
    DateTime ExpiresAt,
    bool IsExpired,
    bool IsAccepted);

public record AcceptInvitationResultDto(
    Guid OrganizationId,
    string OrganizationName,
    string OrganizationSlug,
    string Role);
