using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Members.Queries;

public record ListOrgMembersQuery(
    string Slug,
    int Page,
    int PageSize,
    string? Search,
    OrgRole? Role) : IRequest<Result<OrgMembersPage>>;

// Caller authorisation (Member+) is enforced by [RequireOrgRole] on the
// controller. This query just runs the projection.
public class ListOrgMembersQueryHandler(IAppDbContext db)
    : IRequestHandler<ListOrgMembersQuery, Result<OrgMembersPage>>
{
    private const int MaxPageSize = 100;
    private const int DefaultPageSize = 20;

    public async Task<Result<OrgMembersPage>> Handle(ListOrgMembersQuery request, CancellationToken ct)
    {
        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<OrgMembersPage>(OrgErrors.NotFound);

        var page = Math.Max(1, request.Page);
        var pageSize = request.PageSize switch
        {
            <= 0 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            var n => n
        };

        var query = db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id && m.RemovedAt == null);

        if (request.Role is { } roleFilter)
            query = query.Where(m => m.Role == roleFilter);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            // Lowercased substring match on both columns. Postgres translates
            // string.ToLower() to LOWER() and Contains() to LIKE — this gives
            // case-insensitive matching without pulling Npgsql.ILIKE into the
            // Application layer.
            var q = request.Search.Trim().ToLowerInvariant();
            query = query.Where(m => m.User.FullName.ToLower().Contains(q)
                                   || m.User.Email.ToLower().Contains(q));
        }

        var total = await query.CountAsync(ct);

        var items = await query
            // Owners first, then Admins, etc., then by join date for stability.
            .OrderBy(m => m.Role)
            .ThenBy(m => m.JoinedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new OrgMemberDto(
                m.UserId,
                m.User.Email,
                m.User.FullName,
                m.User.AvatarUrl,
                m.Role.ToString(),
                m.JoinedAt))
            .ToListAsync(ct);

        return Result.Success(new OrgMembersPage(items, total, page, pageSize));
    }
}
