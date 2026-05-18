using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Tasks.Commands;

public record CreateTaskCommand(
    Guid ProjectId,
    Guid? EpicId,
    Guid? SprintId,
    string Title,
    string? Description,
    string? Priority,
    int? StoryPoints,
    Guid? AssigneeId,
    Guid? ReviewerId,
    DateTime? DueDate,
    string[]? AcceptanceCriteria) : IRequest<Result<TaskDto>>;

public class CreateTaskCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(CreateTaskCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TaskDto>(AuthErrors.NotAuthenticated);

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length < 2 || title.Length > 200)
            return Result.Failure<TaskDto>(TaskErrors.InvalidTitle);

        if (request.StoryPoints is < 0)
            return Result.Failure<TaskDto>(TaskErrors.InvalidStoryPoints);

        var priority = Priority.Medium;
        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            if (!Enum.TryParse(request.Priority, ignoreCase: true, out priority))
                return Result.Failure<TaskDto>(TaskErrors.InvalidPriority);
        }

        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct);
        if (project is null)
            return Result.Failure<TaskDto>(ProjectErrors.NotFound);

        if (request.EpicId is { } epicId)
        {
            var epicProjectId = await db.Epics
                .Where(e => e.Id == epicId)
                .Select(e => (Guid?)e.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (epicProjectId is null || epicProjectId != project.Id)
                return Result.Failure<TaskDto>(TaskErrors.EpicNotInProject);
        }

        if (request.SprintId is { } sprintId)
        {
            var sprintProjectId = await db.Sprints
                .Where(s => s.Id == sprintId)
                .Select(s => (Guid?)s.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (sprintProjectId is null || sprintProjectId != project.Id)
                return Result.Failure<TaskDto>(TaskErrors.SprintNotInProject);
        }

        var assigneeId = request.AssigneeId;
        if (project.IsPersonal)
        {
            // Personal projects always belong to their owner; assignee is forced.
            if (assigneeId is not null && assigneeId != project.OwnerUserId)
                return Result.Failure<TaskDto>(TaskErrors.PersonalAssigneeLocked);
            assigneeId = project.OwnerUserId;
        }

        var nextOrder = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.PriorityOrder)
            .MaxAsync(ct) ?? 1;

        var nextKeyNum = 1 + await db.Tasks
            .Where(t => t.ProjectId == project.Id)
            .Select(t => (int?)t.KeyNum)
            .MaxAsync(ct) ?? 1;

        var ac = (request.AcceptanceCriteria ?? [])
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim())
            .ToArray();

        var task = new TaskEntity
        {
            ProjectId = project.Id,
            KeyNum = nextKeyNum,
            EpicId = request.EpicId,
            SprintId = request.SprintId,
            Title = title,
            Description = request.Description,
            StoryPoints = request.StoryPoints,
            Priority = priority,
            Status = DomainTaskStatus.Backlog,
            AssigneeId = assigneeId,
            ReviewerId = request.ReviewerId,
            ReporterId = userId,
            DueDate = request.DueDate,
            PriorityOrder = nextOrder,
            AcceptanceCriteria = ac,
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(task, project.Key));
    }

    /// <summary>Build a TaskDto. Caller passes the project's Key so we can
    /// compose the display key without a second DB roundtrip.</summary>
    internal static TaskDto ToDto(TaskEntity t, string projectKey) => new(
        t.Id, $"{projectKey}-{t.KeyNum}", t.KeyNum,
        t.ProjectId, t.EpicId, t.SprintId,
        t.Title, t.Description,
        t.Status.ToString(), t.Priority.ToString(),
        t.StoryPoints,
        t.AssigneeId, t.ReviewerId, t.ReporterId,
        t.DueDate, t.PriorityOrder, t.AcceptanceCriteria,
        t.TimeLoggedMinutes, t.PrUrl,
        t.CreatedByAi, t.CreatedAt);
}
