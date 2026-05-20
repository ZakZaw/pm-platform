using System.Text.Json;
using Application.Common;
using Application.Features.Tasks;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.AI.Commands;

/// <summary>
/// Persist an AI-generated list of tasks into an existing project (and
/// optionally an existing epic). Each task gets a fresh KeyNum and is
/// appended to the bottom of the project priority order — same semantics
/// as a hand-created task.
/// </summary>
public record ApplyTaskListCommand(
    Guid ProjectId,
    Guid? EpicId,
    IReadOnlyList<AIGeneratedTaskDto> Tasks) : IRequest<Result<IReadOnlyList<TaskDto>>>;

public class ApplyTaskListCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ApplyTaskListCommand, Result<IReadOnlyList<TaskDto>>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<IReadOnlyList<TaskDto>>> Handle(
        ApplyTaskListCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<TaskDto>>(AuthErrors.NotAuthenticated);

        if (request.Tasks is null || request.Tasks.Count == 0)
            return Result.Failure<IReadOnlyList<TaskDto>>(AIErrors.EmptyResult);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Key })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<IReadOnlyList<TaskDto>>(ProjectErrors.NotFound);

        if (request.EpicId is { } epicId)
        {
            var ok = await db.Epics
                .AnyAsync(e => e.Id == epicId && e.ProjectId == project.Id, ct);
            if (!ok)
                return Result.Failure<IReadOnlyList<TaskDto>>(TaskErrors.EpicNotInProject);
        }

        var nextKeyNum = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.KeyNum)
            .MaxAsync(ct) ?? 1;

        var nextOrder = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.PriorityOrder)
            .MaxAsync(ct) ?? 1;

        var created = new List<TaskEntity>();
        foreach (var taskDto in request.Tasks)
        {
            var title = (taskDto.Title ?? string.Empty).Trim();
            if (title.Length is < 2 or > 200)
                return Result.Failure<IReadOnlyList<TaskDto>>(TaskErrors.InvalidTitle);

            var entity = new TaskEntity
            {
                ProjectId = project.Id,
                KeyNum = nextKeyNum++,
                EpicId = request.EpicId,
                Title = title,
                Description = taskDto.Description,
                StoryPoints = taskDto.StoryPoints > 0 ? taskDto.StoryPoints : null,
                Priority = ParsePriority(taskDto.Priority),
                Status = DomainTaskStatus.Backlog,
                PriorityOrder = nextOrder++,
                AcceptanceCriteria = (taskDto.AcceptanceCriteria ?? [])
                    .Where(ac => !string.IsNullOrWhiteSpace(ac))
                    .Select(ac => ac.Trim())
                    .ToArray(),
                ReporterId = userId,
                CreatedByAi = true,
            };
            db.Tasks.Add(entity);
            created.Add(entity);
        }

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "task-list.generate.apply",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = $"Apply {created.Count} AI-drafted tasks",
            Response = JsonSerializer.Serialize(request.Tasks, JsonOpts),
            AfterStateJson = JsonSerializer.Serialize(new
            {
                epicId = request.EpicId,
                taskCount = created.Count,
            }, JsonOpts),
            Applied = true,
            AppliedAt = DateTime.UtcNow,
            Provider = "n/a",
            Model = "n/a",
        });

        await db.SaveChangesAsync(ct);

        return Result.Success<IReadOnlyList<TaskDto>>(
            created.Select(t => CreateTaskCommandHandler.ToDto(t, project.Key)).ToList());
    }

    private static Priority ParsePriority(string? raw)
        => Enum.TryParse<Priority>(raw, ignoreCase: true, out var p) ? p : Priority.Medium;
}
