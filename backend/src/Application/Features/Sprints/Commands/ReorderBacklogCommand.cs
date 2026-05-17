using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Commands;

/// <summary>
/// Sets the absolute order of all backlog tasks in the given project.
/// The caller sends the full ordered list of task IDs after their drag
/// operation; we re-number PriorityOrder from 1..N in that order. Atomic.
/// </summary>
public record ReorderBacklogCommand(Guid ProjectId, IReadOnlyList<Guid> OrderedTaskIds)
    : IRequest<Result>;

public class ReorderBacklogCommandHandler(IAppDbContext db)
    : IRequestHandler<ReorderBacklogCommand, Result>
{
    public async Task<Result> Handle(ReorderBacklogCommand request, CancellationToken ct)
    {
        var tasks = await db.Tasks
            .Where(t => t.ProjectId == request.ProjectId && request.OrderedTaskIds.Contains(t.Id))
            .ToListAsync(ct);

        var byId = tasks.ToDictionary(t => t.Id);
        for (var i = 0; i < request.OrderedTaskIds.Count; i++)
        {
            if (byId.TryGetValue(request.OrderedTaskIds[i], out var task))
            {
                task.PriorityOrder = i + 1;
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
