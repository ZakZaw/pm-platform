using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Stories.Commands;

public record CreateStoryCommand(
    Guid ProjectId,
    Guid? EpicId,
    string Title,
    string? Description,
    int? StoryPoints,
    string? Priority,
    string[]? AcceptanceCriteria,
    Guid? AssigneeId,
    DateTime? DueDate) : IRequest<Result<StoryDto>>;

public class CreateStoryCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateStoryCommand, Result<StoryDto>>
{
    public async Task<Result<StoryDto>> Handle(CreateStoryCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<StoryDto>(AuthErrors.NotAuthenticated);

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length < 2 || title.Length > 200)
            return Result.Failure<StoryDto>(StoryErrors.InvalidTitle);

        var priority = Priority.Medium;
        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            if (!Enum.TryParse(request.Priority, ignoreCase: true, out priority))
                return Result.Failure<StoryDto>(StoryErrors.InvalidPriority);
        }

        if (request.StoryPoints is < 0)
            return Result.Failure<StoryDto>(StoryErrors.InvalidStoryPoints);

        var maxOrder = await db.Stories
            .Where(s => s.ProjectId == request.ProjectId)
            .Select(s => (int?)s.PriorityOrder)
            .MaxAsync(ct) ?? 0;

        var story = new Story
        {
            ProjectId = request.ProjectId,
            EpicId = request.EpicId,
            Title = title,
            Description = request.Description,
            StoryPoints = request.StoryPoints,
            Priority = priority,
            Status = DomainTaskStatus.Backlog,
            AssigneeId = request.AssigneeId,
            ReporterId = userId,
            DueDate = request.DueDate,
            PriorityOrder = maxOrder + 1,
            AcceptanceCriteria = request.AcceptanceCriteria ?? []
        };
        db.Stories.Add(story);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(story));
    }

    internal static StoryDto ToDto(Story s) => new(
        s.Id, s.ProjectId, s.EpicId, s.SprintId, s.Title, s.Description, s.StoryPoints,
        s.Priority.ToString(), s.Status.ToString(),
        s.AssigneeId, s.ReporterId, s.DueDate, s.PriorityOrder,
        s.AcceptanceCriteria, s.CreatedByAi, s.CreatedAt);
}
