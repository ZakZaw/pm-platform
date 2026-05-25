using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Queries;

public record GetProjectBySlugQuery(string OrgSlug, string ProjectSlug) : IRequest<Result<ProjectDto>>;

public class GetProjectBySlugQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetProjectBySlugQuery, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(GetProjectBySlugQuery request, CancellationToken ct)
    {
        var userId = currentUser.UserId;

        var project = await db.Projects
            .Where(p => !p.IsPersonal
                         && p.Organization != null
                         && p.Organization.Slug == request.OrgSlug
                         && p.Slug == request.ProjectSlug)
            .Select(p => new
            {
                Dto = new ProjectDto(
                    p.Id, p.OrganizationId, p.Organization!.Slug,
                    p.Name, p.Slug, p.Key,
                    p.Type.ToString(),
                    p.Status.ToString(),
                    p.TargetDate,
                    p.AIControlMode.ToString(),
                    p.CreatedBy, p.CreatedAt,
                    p.IsPersonal,
                    null),
                MyRole = userId == null ? null : db.ProjectMemberships
                    .Where(m => m.ProjectId == p.Id && m.UserId == userId)
                    .Select(m => (string?)m.Role.ToString())
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(ct);

        if (project is null) return Result.Failure<ProjectDto>(ProjectErrors.NotFound);
        return Result.Success(project.Dto with { MyRole = project.MyRole });
    }
}
