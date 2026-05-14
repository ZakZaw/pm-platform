namespace Application.Features.Organizations.Members;

public record OrgMemberDto(
    Guid UserId,
    string Email,
    string FullName,
    string? AvatarUrl,
    string Role,
    DateTime JoinedAt);

public record OrgMembersPage(
    IReadOnlyList<OrgMemberDto> Items,
    int Total,
    int Page,
    int PageSize);
