using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Commands;

public record AddTaskToSprintCommand(Guid SprintId, Guid TaskId) : IRequest<Result>;

public class AddTaskToSprintCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<AddTaskToSprintCommand, Result>
{
    public async Task<Result> Handle(AddTaskToSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null) return Result.Failure(SprintErrors.NotFound);

        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure(TaskErrors.NotFound);
        if (task.ProjectId != sprint.ProjectId)
            return Result.Failure(TaskErrors.SprintNotInProject);

        task.SprintId = sprint.Id;
        await db.SaveChangesAsync(ct);
        await events.PublishAsync(task.ProjectId, "board.changed",
            new { taskId = task.Id, sprintId = sprint.Id }, ct);
        return Result.Success();
    }
}

public record RemoveTaskFromSprintCommand(Guid TaskId) : IRequest<Result>;

public class RemoveTaskFromSprintCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<RemoveTaskFromSprintCommand, Result>
{
    public async Task<Result> Handle(RemoveTaskFromSprintCommand request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure(TaskErrors.NotFound);
        task.SprintId = null;
        await db.SaveChangesAsync(ct);
        await events.PublishAsync(task.ProjectId, "board.changed",
            new { taskId = task.Id, sprintId = (Guid?)null }, ct);
        return Result.Success();
    }
}
