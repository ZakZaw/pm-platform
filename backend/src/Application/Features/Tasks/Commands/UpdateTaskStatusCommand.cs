using Application.Common;
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
    IProjectEventBus events)
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

        var projectId = await db.Stories
            .Where(s => s.Id == task.StoryId)
            .Select(s => s.ProjectId)
            .FirstOrDefaultAsync(ct);
        if (projectId != Guid.Empty)
        {
            await events.PublishAsync(projectId, "board.changed", new { taskId = task.Id }, ct);
        }
        return Result.Success(CreateTaskCommandHandler.ToDto(task));
    }

    private static Error MapDomainError(DomainException ex, string from, string to) => ex.Code switch
    {
        "Task.InvalidTransition" => TaskErrors.InvalidTransition(from, to),
        "Task.ReasonRequired" => TaskErrors.ReasonRequired(to),
        "Task.NoOpTransition" => TaskErrors.NoOpTransition,
        _ => new Error(ex.Code, ex.Message)
    };
}
