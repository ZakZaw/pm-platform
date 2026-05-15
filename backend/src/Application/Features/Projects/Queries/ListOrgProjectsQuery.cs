using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Queries;

public record ListOrgProjectsQuery(string OrgSlug) : IRequest<Result<IReadOnlyList<ProjectSummary>>>;

public class ListOrgProjectsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListOrgProjectsQuery, Result<IReadOnlyList<ProjectSummary>>>
{
    public async Task<Result<IReadOnlyList<ProjectSummary>>> Handle(ListOrgProjectsQuery request, CancellationToken ct)
    {
        var orgId = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => (Guid?)o.Id)
            .FirstOrDefaultAsync(ct);
        if (orgId is null)
            return Result.Failure<IReadOnlyList<ProjectSummary>>(OrgErrors.NotFound);

        var projects = await db.Projects
            .Where(p => p.OrganizationId == orgId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ProjectSummary(
                p.Id, p.Name, p.Slug,
                p.EnvironmentType.ToString(),
                p.Status.ToString(),
                p.TargetDate))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ProjectSummary>>(projects);
    }
}
