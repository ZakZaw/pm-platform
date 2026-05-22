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
    string Type,
    string? AIControlMode,
    DateTime? TargetDate) : IRequest<Result<ProjectDto>>;

public class CreateProjectCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectTypeRegistry projectTypes)
    : IRequestHandler<CreateProjectCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(CreateProjectCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var trimmedName = request.Name?.Trim() ?? string.Empty;
        if (trimmedName.Length < 2 || trimmedName.Length > 120 || SlugGenerator.From(trimmedName).Length == 0)
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidName);

        if (!Enum.TryParse<ProjectType>(request.Type, ignoreCase: true, out var projectType))
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidType);

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
        var key = await ResolveUniqueKeyAsync(org.Id, ProjectKeyGenerator.From(trimmedName), ct);

        var project = new Project
        {
            OrganizationId = org.Id,
            Name = trimmedName,
            Slug = slug,
            Key = key,
            Type = projectType,
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

        // Type-specific seeding (Sales → default pipeline stages, etc.).
        await projectTypes.Get(projectType).SeedNewProjectAsync(db, project.Id, userId, ct);

        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id, project.OrganizationId, org.Slug,
            project.Name, project.Slug, project.Key,
            project.Type.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy, project.CreatedAt,
            project.IsPersonal));
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

    private async Task<string> ResolveUniqueKeyAsync(Guid orgId, string baseKey, CancellationToken ct)
    {
        var key = baseKey;
        var suffix = 1;
        while (await db.Projects.AnyAsync(p => p.OrganizationId == orgId && p.Key == key, ct))
        {
            suffix++;
            key = ProjectKeyGenerator.WithSuffix(baseKey, suffix);
            if (suffix > 999)
                key = baseKey + Guid.NewGuid().ToString("N").Substring(0, 4).ToUpperInvariant();
        }
        return key;
    }
}
