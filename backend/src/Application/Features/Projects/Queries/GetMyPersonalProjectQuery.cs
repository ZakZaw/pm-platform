using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Queries;

/// <summary>
/// Returns (and lazily auto-provisions) the caller's private "Personal"
/// project. Personal projects are not tied to an organisation and are not
/// listed alongside normal org projects — they're reached only via this
/// dedicated endpoint or by their owner.
/// </summary>
public record GetMyPersonalProjectQuery() : IRequest<Result<ProjectDto>>;

public class GetMyPersonalProjectQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyPersonalProjectQuery, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(GetMyPersonalProjectQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var existing = await db.Projects
            .Where(p => p.IsPersonal && p.OwnerUserId == userId)
            .Select(p => new ProjectDto(
                p.Id, p.OrganizationId, null,
                p.Name, p.Slug,
                p.EnvironmentType.ToString(),
                p.Status.ToString(),
                p.TargetDate,
                p.AIControlMode.ToString(),
                p.CreatedBy, p.CreatedAt,
                p.IsPersonal))
            .FirstOrDefaultAsync(ct);
        if (existing is not null) return Result.Success(existing);

        var project = new Project
        {
            OrganizationId = null,
            OwnerUserId = userId,
            IsPersonal = true,
            Name = "Personal",
            Slug = $"personal-{userId:N}",
            EnvironmentType = Domain.Enums.EnvironmentType.Business,
            Status = Domain.Enums.ProjectStatus.Active,
            AIControlMode = Domain.Enums.AIControlMode.Off,
            CreatedBy = userId,
        };
        db.Projects.Add(project);
        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id, null, null,
            project.Name, project.Slug,
            project.EnvironmentType.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy, project.CreatedAt,
            project.IsPersonal));
    }
}
