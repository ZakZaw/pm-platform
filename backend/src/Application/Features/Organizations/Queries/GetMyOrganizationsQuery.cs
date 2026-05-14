using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Organizations.Queries;

public record GetMyOrganizationsQuery : IRequest<Result<IReadOnlyList<OrgSummary>>>;

public class GetMyOrganizationsQueryHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<GetMyOrganizationsQuery, Result<IReadOnlyList<OrgSummary>>>
{
    public async Task<Result<IReadOnlyList<OrgSummary>>> Handle(GetMyOrganizationsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<OrgSummary>>(AuthErrors.NotAuthenticated);

        var rows = await db.OrgMemberships
            .Where(m => m.UserId == userId && m.RemovedAt == null)
            .OrderBy(m => m.JoinedAt)
            .Select(m => new OrgSummary(
                m.Organization.Id,
                m.Organization.Name,
                m.Organization.Slug,
                m.Organization.LogoUrl,
                m.Role.ToString()))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<OrgSummary>>(rows);
    }
}
