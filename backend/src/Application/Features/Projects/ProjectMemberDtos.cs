namespace Application.Features.Projects;

public record ProjectMemberDto(
    Guid UserId,
    string Email,
    string FullName,
    string? AvatarUrl,
    string Role,
    DateTime JoinedAt);
