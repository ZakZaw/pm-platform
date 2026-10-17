using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Commands;

public record DeleteTaskCommand(Guid TaskId) : IRequest<Result>;

public class DeleteTaskCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<DeleteTaskCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskCommand request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null)
            return Result.Failure(TaskErrors.NotFound);
        db.Tasks.Remove(task);
        await db.SaveChangesAsync(ct);
        await events.PublishAsync(task.ProjectId, ProjectEvents.BoardChanged, new { taskId = task.Id }, ct);
        return Result.Success();
    }
}
