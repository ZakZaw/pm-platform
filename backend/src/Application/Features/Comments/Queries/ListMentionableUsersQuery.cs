using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Comments.Queries;

/// <summary>
/// Returns up to 50 org members of the project's org so the comment input
/// can show a "@" dropdown. Optional query string filters by name/email
/// prefix-style match (case-insensitive contains).
/// </summary>
public record ListMentionableUsersQuery(Guid ProjectId, string? Query)
    : IRequest<Result<IReadOnlyList<MentionableUserDto>>>;

public class ListMentionableUsersQueryHandler(IAppDbContext db)
    : IRequestHandler<ListMentionableUsersQuery, Result<IReadOnlyList<MentionableUserDto>>>
{
    public async Task<Result<IReadOnlyList<MentionableUserDto>>> Handle(
        ListMentionableUsersQuery request, CancellationToken ct)
    {
        var orgId = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstOrDefaultAsync(ct);
        if (orgId is null || orgId == Guid.Empty)
            return Result.Failure<IReadOnlyList<MentionableUserDto>>(ProjectErrors.NotFound);

        var baseQuery = db.OrgMemberships
            .Where(m => m.OrganizationId == orgId && m.RemovedAt == null)
            .Select(m => m.User);

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var q = request.Query.Trim().ToLower();
            baseQuery = baseQuery.Where(u =>
                u.FullName.ToLower().Contains(q) || u.Email.ToLower().Contains(q));
        }

        var rows = await baseQuery
            .OrderBy(u => u.FullName)
            .Take(50)
            .Select(u => new MentionableUserDto(u.Id, u.FullName, u.Email, u.AvatarUrl))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<MentionableUserDto>>(rows);
    }
}
