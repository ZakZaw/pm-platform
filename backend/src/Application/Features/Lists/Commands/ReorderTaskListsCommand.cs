using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Lists.Commands;

/// <summary>Replaces the per-project list ordering. The caller sends the
/// list ids in the desired top-to-bottom order; any ids that don't belong
/// to the project are ignored. Lists in the project but missing from the
/// payload keep their existing relative order, pushed to the bottom.</summary>
public record ReorderTaskListsCommand(Guid ProjectId, IReadOnlyList<Guid> OrderedListIds)
    : IRequest<Result>;

public class ReorderTaskListsCommandHandler(IAppDbContext db)
    : IRequestHandler<ReorderTaskListsCommand, Result>
{
    public async Task<Result> Handle(ReorderTaskListsCommand request, CancellationToken ct)
    {
        if (request.OrderedListIds is null || request.OrderedListIds.Count == 0)
            return Result.Failure(TaskListErrors.EmptyReorder);

        var lists = await db.TaskLists
            .Where(l => l.ProjectId == request.ProjectId)
            .ToListAsync(ct);

        var byId = lists.ToDictionary(l => l.Id);
        var ordered = request.OrderedListIds.Where(id => byId.ContainsKey(id)).ToList();
        var remaining = lists
            .Where(l => !ordered.Contains(l.Id))
            .OrderBy(l => l.Order)
            .ThenBy(l => l.CreatedAt)
            .ToList();

        var i = 1;
        foreach (var id in ordered) byId[id].Order = i++;
        foreach (var l in remaining) l.Order = i++;

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
