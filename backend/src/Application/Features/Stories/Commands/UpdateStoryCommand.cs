using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Stories.Commands;

public record UpdateStoryCommand(
    Guid StoryId,
    string? Title,
    string? Description,
    int? StoryPoints,
    string? Priority,
    Guid? EpicId,
    Guid? AssigneeId,
    DateTime? DueDate,
    string[]? AcceptanceCriteria) : IRequest<Result<StoryDto>>;

public class UpdateStoryCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateStoryCommand, Result<StoryDto>>
{
    public async Task<Result<StoryDto>> Handle(UpdateStoryCommand request, CancellationToken ct)
    {
        var story = await db.Stories.FirstOrDefaultAsync(s => s.Id == request.StoryId, ct);
        if (story is null)
            return Result.Failure<StoryDto>(StoryErrors.NotFound);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length < 2 || t.Length > 200)
                return Result.Failure<StoryDto>(StoryErrors.InvalidTitle);
            story.Title = t;
        }

        if (request.Description is not null) story.Description = request.Description;
        if (request.EpicId.HasValue) story.EpicId = request.EpicId;
        if (request.AssigneeId.HasValue) story.AssigneeId = request.AssigneeId;
        if (request.DueDate.HasValue) story.DueDate = request.DueDate;
        if (request.AcceptanceCriteria is not null) story.AcceptanceCriteria = request.AcceptanceCriteria;

        if (request.StoryPoints.HasValue)
        {
            if (request.StoryPoints < 0)
                return Result.Failure<StoryDto>(StoryErrors.InvalidStoryPoints);
            story.StoryPoints = request.StoryPoints;
        }

        if (request.Priority is not null)
        {
            if (!Enum.TryParse<Priority>(request.Priority, ignoreCase: true, out var priority))
                return Result.Failure<StoryDto>(StoryErrors.InvalidPriority);
            story.Priority = priority;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(CreateStoryCommandHandler.ToDto(story));
    }
}
