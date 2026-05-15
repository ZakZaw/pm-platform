using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Commands;

public record CreateProjectCommand(
    string OrgSlug,
    string Name,
    string EnvironmentType,
    string? AIControlMode,
    DateTime? TargetDate) : IRequest<Result<ProjectDto>>;

public class CreateProjectCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateProjectCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(CreateProjectCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (trimmedName.Length < 2 || trimmedName.Length > 120 || SlugGenerator.From(trimmedName).Length == 0)
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidName);

        if (!Enum.TryParse<EnvironmentType>(request.EnvironmentType, ignoreCase: true, out var envType))
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidEnvironmentType);

        var aiMode = AIControlMode.Suggest;
        if (!string.IsNullOrWhiteSpace(request.AIControlMode))
        {
            if (!Enum.TryParse(request.AIControlMode, ignoreCase: true, out aiMode))
                return Result.Failure<ProjectDto>(ProjectErrors.InvalidAIControlMode);
        }

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id, o.Slug })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<ProjectDto>(OrgErrors.NotFound);

        var slug = await ResolveUniqueSlugAsync(org.Id, SlugGenerator.From(trimmedName), ct);

        var project = new Project
        {
            OrganizationId = org.Id,
            Name = trimmedName,
            Slug = slug,
            EnvironmentType = envType,
            Status = ProjectStatus.Active,
            TargetDate = request.TargetDate,
            AIControlMode = aiMode,
            CreatedBy = userId
        };
        db.Projects.Add(project);

        db.ProjectMemberships.Add(new ProjectMembership
        {
            ProjectId = project.Id,
            UserId = userId,
            Role = ProjectRole.PM
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id, project.OrganizationId, org.Slug,
            project.Name, project.Slug,
            project.EnvironmentType.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy, project.CreatedAt));
    }

    private async Task<string> ResolveUniqueSlugAsync(Guid orgId, string baseSlug, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "project";
        var slug = baseSlug;
        var suffix = 2;
        while (await db.Projects.AnyAsync(p => p.OrganizationId == orgId && p.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix++}";
            if (suffix > 1000)
                slug = $"{baseSlug}-{Guid.NewGuid():N}".Substring(0, Math.Min(baseSlug.Length + 9, 60));
        }
        return slug;
    }
}
