using System.Text.Json;
using Application.Common;
using Application.Features.Epics;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.AI.Commands;

/// <summary>
/// Persist an AI-generated epic (with its tasks) into an existing project.
/// Mirrors <see cref="ApplyProjectGenerationCommand"/> but scoped to one epic
/// and an existing project — so there's no project create, no
/// AIGenerationRequest row, and tasks share the project's KeyNum sequence.
/// </summary>
public record ApplyEpicGenerationCommand(
    Guid ProjectId,
    AIGeneratedEpicDto Epic) : IRequest<Result<EpicDto>>;

public class ApplyEpicGenerationCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ApplyEpicGenerationCommand, Result<EpicDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<EpicDto>> Handle(ApplyEpicGenerationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<EpicDto>(AuthErrors.NotAuthenticated);

        if (request.Epic is null)
            return Result.Failure<EpicDto>(AIErrors.InvalidPayload);

        var title = (request.Epic.Title ?? string.Empty).Trim();
        if (title.Length is < 2 or > 200)
            return Result.Failure<EpicDto>(EpicErrors.InvalidTitle);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.EnvironmentType })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<EpicDto>(ProjectErrors.NotFound);

        var epic = new Epic
        {
            ProjectId = project.Id,
            Title = title,
            Description = request.Epic.Description,
            Color = request.Epic.Color,
            EnvironmentType = project.EnvironmentType,
            Status = EpicStatus.Planning,
            CreatedByAi = true,
        };
        db.Epics.Add(epic);

        var nextKeyNum = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.KeyNum)
            .MaxAsync(ct) ?? 1;

        var nextOrder = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.PriorityOrder)
            .MaxAsync(ct) ?? 1;

        var totalPts = 0;
        foreach (var taskDto in request.Epic.Tasks ?? [])
        {
            var pts = taskDto.StoryPoints > 0 ? taskDto.StoryPoints : (int?)null;
            db.Tasks.Add(new TaskEntity
            {
                ProjectId = project.Id,
                KeyNum = nextKeyNum++,
                EpicId = epic.Id,
                Title = TrimOrDefault(taskDto.Title, "Untitled task"),
                Description = taskDto.Description,
                StoryPoints = pts,
                Priority = ParsePriority(taskDto.Priority),
                Status = DomainTaskStatus.Backlog,
                PriorityOrder = nextOrder++,
                AcceptanceCriteria = (taskDto.AcceptanceCriteria ?? [])
                    .Where(ac => !string.IsNullOrWhiteSpace(ac))
                    .Select(ac => ac.Trim())
                    .ToArray(),
                ReporterId = userId,
                CreatedByAi = true,
            });
            if (pts is not null) totalPts += pts.Value;
        }

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "epic.generate.apply",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = title,
            Response = JsonSerializer.Serialize(request.Epic, JsonOpts),
            AfterStateJson = JsonSerializer.Serialize(new
            {
                epicId = epic.Id,
                taskCount = request.Epic.Tasks?.Count ?? 0,
            }, JsonOpts),
            Applied = true,
            AppliedAt = DateTime.UtcNow,
            Provider = "n/a",
            Model = "n/a",
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new EpicDto(
            epic.Id, epic.ProjectId, epic.Title, epic.Description, epic.OwnerId,
            epic.Status.ToString(), epic.RiskFlag,
            epic.EnvironmentType?.ToString(), epic.Color,
            epic.CreatedAt, epic.ArchivedAt,
            TaskCount: request.Epic.Tasks?.Count ?? 0,
            TotalStoryPoints: totalPts,
            DoneStoryPoints: 0));
    }

    private static string TrimOrDefault(string? s, string fallback)
    {
        var t = s?.Trim();
        return string.IsNullOrEmpty(t) ? fallback : t;
    }

    private static Priority ParsePriority(string? raw)
        => Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : Priority.Medium;
}
