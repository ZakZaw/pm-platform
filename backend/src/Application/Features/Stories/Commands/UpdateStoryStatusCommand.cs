using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Stories.Commands;

/// <summary>
/// Story status changes are looser than Task status changes (the formal
/// state machine in /Domain only applies to Task). Stories use the same
/// enum because they share the Kanban columns, but any transition is
/// allowed since stories aggregate work that may swing back and forth.
/// </summary>
public record UpdateStoryStatusCommand(Guid StoryId, string To) : IRequest<Result<StoryDto>>;

public class UpdateStoryStatusCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateStoryStatusCommand, Result<StoryDto>>
{
    public async Task<Result<StoryDto>> Handle(UpdateStoryStatusCommand request, CancellationToken ct)
    {
        if (!Enum.TryParse<DomainTaskStatus>(request.To, ignoreCase: true, out var target))
            return Result.Failure<StoryDto>(TaskErrors.InvalidStatus);

        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        if (story is null)
            return Result.Failure<StoryDto>(StoryErrors.NotFound);

        story.Status = target;
        await db.SaveChangesAsync(ct);
        return Result.Success(CreateStoryCommandHandler.ToDto(story));
    }
}
