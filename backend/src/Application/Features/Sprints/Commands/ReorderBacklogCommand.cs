using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Commands;

/// <summary>
/// Sets the absolute order of all backlog stories in the given project.
/// The caller sends the full ordered list of story IDs after their drag
/// operation; we re-number PriorityOrder from 1..N in that order. Atomic.
/// </summary>
public record ReorderBacklogCommand(Guid ProjectId, IReadOnlyList<Guid> OrderedStoryIds)
    : IRequest<Result>;

public class ReorderBacklogCommandHandler(IAppDbContext db)
    : IRequestHandler<ReorderBacklogCommand, Result>
{
    public async Task<Result> Handle(ReorderBacklogCommand request, CancellationToken ct)
    {
        var stories = await db.Stories
            .Where(s => s.ProjectId == request.ProjectId && request.OrderedStoryIds.Contains(s.Id))
            .ToListAsync(ct);

        var byId = stories.ToDictionary(s => s.Id);
        for (var i = 0; i < request.OrderedStoryIds.Count; i++)
        {
            if (byId.TryGetValue(request.OrderedStoryIds[i], out var story))
            {
                story.PriorityOrder = i + 1;
            }
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
