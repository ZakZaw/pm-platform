using Application.Common;
using Application.Features.Stories.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Stories.Queries;

public record GetStoryQuery(Guid StoryId) : IRequest<Result<StoryDto>>;

public class GetStoryQueryHandler(IAppDbContext db)
    : IRequestHandler<GetStoryQuery, Result<StoryDto>>
{
    public async Task<Result<StoryDto>> Handle(GetStoryQuery request, CancellationToken ct)
    {
        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        return story is null
            ? Result.Failure<StoryDto>(StoryErrors.NotFound)
            : Result.Success(CreateStoryCommandHandler.ToDto(story));
    }
}
