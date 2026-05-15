using System.Text.Json;
using Application.Common;
using Application.Features.Projects;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.AI.Commands;

public record ApplyProjectGenerationCommand(
    Guid RequestId,
    string ProjectName,
    string EnvironmentType,
    IReadOnlyList<AIGeneratedEpicDto> Epics) : IRequest<Result<ProjectDto>>;

public class ApplyProjectGenerationCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ApplyProjectGenerationCommand, Result<ProjectDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<ProjectDto>> Handle(
        ApplyProjectGenerationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var name = (request.ProjectName ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120 || SlugGenerator.From(name).Length == 0)
            return Result.Failure<ProjectDto>(AIErrors.InvalidProjectName);

        if (!Enum.TryParse<EnvironmentType>(request.EnvironmentType, ignoreCase: true, out var envType))
            return Result.Failure<ProjectDto>(ProjectErrors.InvalidEnvironmentType);

        var generationRequest = await db.AIGenerationRequests
            .FirstOrDefaultAsync(r => r.Id == request.RequestId, ct);
        if (generationRequest is null)
            return Result.Failure<ProjectDto>(AIErrors.RequestNotFound);
        if (generationRequest.Status != "Draft")
            return Result.Failure<ProjectDto>(AIErrors.RequestAlreadyApplied);

        if (request.Epics is null || request.Epics.Count == 0)
            return Result.Failure<ProjectDto>(AIErrors.EmptyResult);

        var orgSlug = await db.Organizations
            .Where(o => o.Id == generationRequest.OrganizationId)
            .Select(o => o.Slug)
            .FirstAsync(ct);

        var slug = await ResolveUniqueSlugAsync(
            generationRequest.OrganizationId, SlugGenerator.From(name), ct);

        var project = new Project
        {
            OrganizationId = generationRequest.OrganizationId,
            Name = name,
            Slug = slug,
            EnvironmentType = envType,
            Status = ProjectStatus.Active,
            AIControlMode = AIControlMode.Suggest,
            CreatedBy = userId,
        };
        db.Projects.Add(project);
        db.ProjectMemberships.Add(new ProjectMembership
        {
            ProjectId = project.Id,
            UserId = userId,
            Role = ProjectRole.PM,
        });

        var priorityOrder = 0;
        foreach (var epicDto in request.Epics)
        {
            var epic = new Epic
            {
                ProjectId = project.Id,
                Title = TrimOrDefault(epicDto.Title, "Untitled epic"),
                Description = epicDto.Description,
                Color = epicDto.Color,
                Status = EpicStatus.Planning,
                CreatedByAi = true,
            };
            db.Epics.Add(epic);

            foreach (var storyDto in epicDto.Stories)
            {
                var priority = ParsePriority(storyDto.Priority);
                var story = new Story
                {
                    ProjectId = project.Id,
                    EpicId = epic.Id,
                    Title = TrimOrDefault(storyDto.Title, "Untitled story"),
                    Description = storyDto.Description,
                    StoryPoints = storyDto.StoryPoints > 0 ? storyDto.StoryPoints : null,
                    Priority = priority,
                    Status = DomainTaskStatus.Backlog,
                    PriorityOrder = priorityOrder++,
                    AcceptanceCriteria = (storyDto.AcceptanceCriteria ?? [])
                        .Where(ac => !string.IsNullOrWhiteSpace(ac))
                        .Select(ac => ac.Trim())
                        .ToArray(),
                    CreatedByAi = true,
                };
                db.Stories.Add(story);

                foreach (var taskDto in storyDto.Tasks ?? [])
                {
                    db.Tasks.Add(new TaskEntity
                    {
                        StoryId = story.Id,
                        Title = TrimOrDefault(taskDto.Title, "Untitled task"),
                        Description = taskDto.Description,
                        Priority = priority,
                        Status = DomainTaskStatus.Backlog,
                        CreatedByAi = true,
                    });
                }
            }
        }

        generationRequest.Status = "Applied";
        generationRequest.AppliedAt = DateTime.UtcNow;
        generationRequest.AppliedProjectId = project.Id;

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "project.generate.apply",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = generationRequest.Description,
            Response = JsonSerializer.Serialize(request.Epics, JsonOpts),
            AfterStateJson = JsonSerializer.Serialize(new
            {
                projectId = project.Id,
                epicCount = request.Epics.Count,
                storyCount = request.Epics.Sum(e => e.Stories.Count),
                taskCount = request.Epics.Sum(e => e.Stories.Sum(s => s.Tasks.Count)),
            }, JsonOpts),
            Applied = true,
            AppliedAt = DateTime.UtcNow,
            Provider = "n/a",
            Model = "n/a",
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id, project.OrganizationId, orgSlug,
            project.Name, project.Slug,
            project.EnvironmentType.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy, project.CreatedAt));
    }

    private static string TrimOrDefault(string? s, string fallback)
    {
        var t = s?.Trim();
        return string.IsNullOrEmpty(t) ? fallback : t;
    }

    private static Priority ParsePriority(string? raw)
        => Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : Priority.Medium;

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
