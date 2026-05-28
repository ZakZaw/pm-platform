using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.ApiKeys;

/// <summary>F2-24 — list an org's API keys (Owner/Admin only). Secrets
/// are never returned — only the display prefix + metadata.</summary>
public record ListApiKeysQuery(string OrgSlug) : IRequest<Result<IReadOnlyList<ApiKeyDto>>>;

public class ListApiKeysQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListApiKeysQuery, Result<IReadOnlyList<ApiKeyDto>>>
{
    public async Task<Result<IReadOnlyList<ApiKeyDto>>> Handle(ListApiKeysQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<ApiKeyDto>>(AuthErrors.NotAuthenticated);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<IReadOnlyList<ApiKeyDto>>(OrgErrors.NotFound);

        var role = await db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id && m.UserId == userId && m.RemovedAt == null)
            .Select(m => (OrgRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        if (role is null)
            return Result.Failure<IReadOnlyList<ApiKeyDto>>(OrgErrors.NotFound);
        if (role is not (OrgRole.Owner or OrgRole.Admin))
            return Result.Failure<IReadOnlyList<ApiKeyDto>>(ApiKeyErrors.Forbidden);

        var now = DateTime.UtcNow;
        var keys = await db.ApiKeys
            .Where(k => k.OrganizationId == org.Id)
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new ApiKeyDto(
                k.Id, k.Name, k.Prefix, k.CreatedBy.FullName,
                k.CreatedAt, k.LastUsedAt, k.ExpiresAt, k.RevokedAt,
                k.RevokedAt == null && (k.ExpiresAt == null || k.ExpiresAt > now)))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ApiKeyDto>>(keys);
    }
}
