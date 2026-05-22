using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Lists.Commands;

/// <summary>Moves a task to a different <see cref="Domain.Entities.TaskList"/>
/// (or to the unsorted bucket when <paramref name="TargetListId"/> is null).
/// The target list must belong to the same project as the task.</summary>
public record MoveTaskToListCommand(Guid TaskId, Guid? TargetListId) : IRequest<Result>;

public class MoveTaskToListCommandHandler(IAppDbContext db)
    : IRequestHandler<MoveTaskToListCommand, Result>
{
    public async Task<Result> Handle(MoveTaskToListCommand request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure(TaskErrors.NotFound);

        if (request.TargetListId is { } targetId)
        {
            var listProjectId = await db.TaskLists
                .Where(l => l.Id == targetId)
                .Select(l => (Guid?)l.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (listProjectId is null)
                return Result.Failure(TaskListErrors.NotFound);
            if (listProjectId != task.ProjectId)
                return Result.Failure(TaskListErrors.NotInProject);
            task.TaskListId = targetId;
        }
        else
        {
            task.TaskListId = null;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
