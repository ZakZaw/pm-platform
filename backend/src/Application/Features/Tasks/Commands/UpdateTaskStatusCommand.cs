using Application.Common;
using Application.Features.Tasks.Notifications;
using Application.Interfaces;
using Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Tasks.Commands;

public record UpdateTaskStatusCommand(Guid TaskId, string To, string? Reason)
    : IRequest<Result<TaskDto>>;

public class UpdateTaskStatusCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events,
    IPublisher mediatorPublisher)
    : IRequestHandler<UpdateTaskStatusCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskStatusCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TaskDto>(AuthErrors.NotAuthenticated);

        if (!Enum.TryParse<DomainTaskStatus>(request.To, ignoreCase: true, out var target))
            return Result.Failure<TaskDto>(TaskErrors.InvalidStatus);

        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        var wasDone = task.Status == DomainTaskStatus.Done;

        try
        {
            var change = task.ChangeStatus(target, userId, request.Reason);
            db.TaskStatusChanges.Add(change);
        }
        catch (DomainException ex)
        {
            return Result.Failure<TaskDto>(MapDomainError(ex, task.Status.ToString(), target.ToString()));
        }

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(task.ProjectId, "board.changed", new { taskId = task.Id }, ct);
        var projectKey = await db.Projects
            .Where(p => p.Id == task.ProjectId)
            .Select(p => p.Key)
            .FirstAsync(ct);

        // F2-09 — fan out to the Task->Done automation handlers (epic auto-
        // complete, unblock dependents, sprint goal progress). The publish
        // happens after SaveChanges so the handlers can read the updated
        // status when they re-query. Handler failures are swallowed — the
        // canonical write already succeeded and shouldn't be reverted.
        if (target == DomainTaskStatus.Done && !wasDone)
        {
            try
            {
                await mediatorPublisher.Publish(new TaskTransitionedToDoneNotification(
                    TaskId: task.Id,
                    ProjectId: task.ProjectId,
                    EpicId: task.EpicId,
                    SprintId: task.SprintId,
                    TaskKey: $"{projectKey}-{task.KeyNum}",
                    TaskTitle: task.Title,
                    TaskPoints: task.StoryPoints ?? 0,
                    ByUserId: userId), ct);
            }
            catch { /* handlers don't roll back the user's status change */ }
        }

        return Result.Success(CreateTaskCommandHandler.ToDto(task, projectKey));
    }

    private static Error MapDomainError(DomainException ex, string from, string to) => ex.Code switch
    {
        "Task.InvalidTransition" => TaskErrors.InvalidTransition(from, to),
        "Task.ReasonRequired" => TaskErrors.ReasonRequired(to),
        "Task.NoOpTransition" => TaskErrors.NoOpTransition,
        _ => new Error(ex.Code, ex.Message)
    };
}
