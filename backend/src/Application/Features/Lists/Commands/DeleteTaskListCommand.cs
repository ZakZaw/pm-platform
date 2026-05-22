using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Lists.Commands;

/// <summary>Deletes a list. Tasks that belonged to it are kept and become
/// unsorted (FK on task.TaskListId is set-null on delete).</summary>
public record DeleteTaskListCommand(Guid ListId) : IRequest<Result>;

public class DeleteTaskListCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteTaskListCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskListCommand request, CancellationToken ct)
    {
        var list = await db.TaskLists.FirstOrDefaultAsync(l => l.Id == request.ListId, ct);
        if (list is null) return Result.Failure(TaskListErrors.NotFound);

        db.TaskLists.Remove(list);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
