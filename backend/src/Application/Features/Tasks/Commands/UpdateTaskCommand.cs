using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Commands;

public record UpdateTaskCommand(
    Guid TaskId,
    string? Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? EpicId,
    bool ClearEpic,
    Guid? SprintId,
    bool ClearSprint,
    Guid? AssigneeId,
    bool ClearAssignee,
    Guid? ReviewerId,
    bool ClearReviewer,
    DateTime? DueDate,
    bool ClearDueDate,
    int? TimeLoggedMinutes,
    string? PrUrl,
    string[]? AcceptanceCriteria) : IRequest<Result<TaskDto>>;

public class UpdateTaskCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskCommand request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        var project = await db.Projects
            .Where(p => p.Id == task.ProjectId)
            .Select(p => new { p.Id, p.Key, p.IsPersonal, p.OwnerUserId })
            .FirstAsync(ct);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length < 2 || t.Length > 200)
                return Result.Failure<TaskDto>(TaskErrors.InvalidTitle);
            task.Title = t;
        }

        if (request.Description is not null) task.Description = request.Description;

        if (request.StoryPoints.HasValue)
        {
            if (request.StoryPoints.Value < 0)
                return Result.Failure<TaskDto>(TaskErrors.InvalidStoryPoints);
            task.StoryPoints = request.StoryPoints.Value;
        }

        if (request.ClearEpic)
        {
            task.EpicId = null;
        }
        else if (request.EpicId.HasValue)
        {
            var epicProjectId = await db.Epics
                .Where(e => e.Id == request.EpicId.Value)
                .Select(e => (Guid?)e.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (epicProjectId is null || epicProjectId != task.ProjectId)
                return Result.Failure<TaskDto>(TaskErrors.EpicNotInProject);
            task.EpicId = request.EpicId.Value;
        }

        if (request.ClearSprint)
        {
            task.SprintId = null;
        }
        else if (request.SprintId.HasValue)
        {
            var sprintProjectId = await db.Sprints
                .Where(s => s.Id == request.SprintId.Value)
                .Select(s => (Guid?)s.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (sprintProjectId is null || sprintProjectId != task.ProjectId)
                return Result.Failure<TaskDto>(TaskErrors.SprintNotInProject);
            task.SprintId = request.SprintId.Value;
        }

        if (project.IsPersonal)
        {
            // Personal-project tasks are pinned to the owner.
            if (request.ClearAssignee
                || (request.AssigneeId.HasValue && request.AssigneeId != project.OwnerUserId))
                return Result.Failure<TaskDto>(TaskErrors.PersonalAssigneeLocked);
            task.AssigneeId = project.OwnerUserId;
        }
        else
        {
            if (request.ClearAssignee) task.AssigneeId = null;
            else if (request.AssigneeId.HasValue) task.AssigneeId = request.AssigneeId;
        }

        if (request.ClearReviewer) task.ReviewerId = null;
        else if (request.ReviewerId.HasValue) task.ReviewerId = request.ReviewerId;

        if (request.ClearDueDate) task.DueDate = null;
        else if (request.DueDate.HasValue) task.DueDate = request.DueDate;

        if (request.TimeLoggedMinutes.HasValue) task.TimeLoggedMinutes = request.TimeLoggedMinutes.Value;
        if (request.PrUrl is not null) task.PrUrl = request.PrUrl;

        if (request.AcceptanceCriteria is not null)
        {
            task.AcceptanceCriteria = request.AcceptanceCriteria
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToArray();
        }

        if (request.Priority is not null)
        {
            if (!Enum.TryParse<Priority>(request.Priority, ignoreCase: true, out var priority))
                return Result.Failure<TaskDto>(TaskErrors.InvalidPriority);
            task.Priority = priority;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(CreateTaskCommandHandler.ToDto(task, project.Key));
    }
}
