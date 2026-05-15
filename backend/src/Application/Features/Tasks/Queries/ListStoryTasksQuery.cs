using Application.Common;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Queries;

public record ListStoryTasksQuery(Guid StoryId) : IRequest<Result<IReadOnlyList<TaskDto>>>;

public class ListStoryTasksQueryHandler(IAppDbContext db)
    : IRequestHandler<ListStoryTasksQuery, Result<IReadOnlyList<TaskDto>>>
{
    public async Task<Result<IReadOnlyList<TaskDto>>> Handle(ListStoryTasksQuery request, CancellationToken ct)
    {
        var tasks = await db.Tasks
            .Where(t => t.StoryId == request.StoryId)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<TaskDto>>(
            tasks.Select(CreateTaskCommandHandler.ToDto).ToList());
    }
}
