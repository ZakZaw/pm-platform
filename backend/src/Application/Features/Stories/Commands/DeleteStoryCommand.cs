using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Stories.Commands;

public record DeleteStoryCommand(Guid StoryId) : IRequest<Result>;

public class DeleteStoryCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteStoryCommand, Result>
{
    public async Task<Result> Handle(DeleteStoryCommand request, CancellationToken ct)
    {
        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        if (story is null)
            return Result.Failure(StoryErrors.NotFound);
        db.Stories.Remove(story);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
