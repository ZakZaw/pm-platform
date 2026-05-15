using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Board;

public record GetBacklogQuery(Guid ProjectId) : IRequest<Result<IReadOnlyList<BacklogStoryDto>>>;

public class GetBacklogQueryHandler(IAppDbContext db)
    : IRequestHandler<GetBacklogQuery, Result<IReadOnlyList<BacklogStoryDto>>>
{
    public async Task<Result<IReadOnlyList<BacklogStoryDto>>> Handle(GetBacklogQuery request, CancellationToken ct)
    {
        var rows = await db.Stories
            .Where(s => s.ProjectId == request.ProjectId && s.SprintId == null)
            .OrderBy(s => s.PriorityOrder)
            .Select(s => new BacklogStoryDto(
                s.Id, s.Title, s.Priority.ToString(), s.Status.ToString(),
                s.StoryPoints, s.EpicId, s.AssigneeId, s.PriorityOrder))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<BacklogStoryDto>>(rows);
    }
}
