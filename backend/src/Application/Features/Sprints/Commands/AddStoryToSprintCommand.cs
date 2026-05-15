using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Commands;

public record AddStoryToSprintCommand(Guid SprintId, Guid StoryId) : IRequest<Result>;

public class AddStoryToSprintCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<AddStoryToSprintCommand, Result>
{
    public async Task<Result> Handle(AddStoryToSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null) return Result.Failure(SprintErrors.NotFound);

        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        if (story is null) return Result.Failure(StoryErrors.NotFound);

        story.SprintId = sprint.Id;
        await db.SaveChangesAsync(ct);
        await events.PublishAsync(story.ProjectId, "board.changed",
            new { storyId = story.Id, sprintId = sprint.Id }, ct);
        return Result.Success();
    }
}

public record RemoveStoryFromSprintCommand(Guid StoryId) : IRequest<Result>;

public class RemoveStoryFromSprintCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<RemoveStoryFromSprintCommand, Result>
{
    public async Task<Result> Handle(RemoveStoryFromSprintCommand request, CancellationToken ct)
    {
        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        if (story is null) return Result.Failure(StoryErrors.NotFound);
        story.SprintId = null;
        await db.SaveChangesAsync(ct);
        await events.PublishAsync(story.ProjectId, "board.changed",
            new { storyId = story.Id, sprintId = (Guid?)null }, ct);
        return Result.Success();
    }
}
