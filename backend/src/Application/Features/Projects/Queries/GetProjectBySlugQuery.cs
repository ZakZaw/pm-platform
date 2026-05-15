using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Queries;

public record GetProjectBySlugQuery(string OrgSlug, string ProjectSlug) : IRequest<Result<ProjectDto>>;

public class GetProjectBySlugQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectBySlugQuery, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(GetProjectBySlugQuery request, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Organization.Slug == request.OrgSlug && p.Slug == request.ProjectSlug)
            .Select(p => new ProjectDto(
                p.Id, p.OrganizationId, p.Organization.Slug,
                p.Name, p.Slug,
                p.EnvironmentType.ToString(),
                p.Status.ToString(),
                p.TargetDate,
                p.AIControlMode.ToString(),
                p.CreatedBy, p.CreatedAt))
            .FirstOrDefaultAsync(ct);

        return project is null
            ? Result.Failure<ProjectDto>(ProjectErrors.NotFound)
            : Result.Success(project);
    }
}
