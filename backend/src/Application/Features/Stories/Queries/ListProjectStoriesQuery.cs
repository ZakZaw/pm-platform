using Application.Common;
using Application.Features.Stories.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Stories.Queries;

public record ListProjectStoriesQuery(Guid ProjectId, Guid? EpicId = null)
    : IRequest<Result<IReadOnlyList<StoryDto>>>;

public class ListProjectStoriesQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectStoriesQuery, Result<IReadOnlyList<StoryDto>>>
{
    public async Task<Result<IReadOnlyList<StoryDto>>> Handle(ListProjectStoriesQuery request, CancellationToken ct)
    {
        var q = db.Stories.Where(s => s.ProjectId == request.ProjectId);
        if (request.EpicId.HasValue) q = q.Where(s => s.EpicId == request.EpicId);

        var stories = await q
            .OrderBy(s => s.PriorityOrder)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<StoryDto>>(
            stories.Select(CreateStoryCommandHandler.ToDto).ToList());
    }
}
