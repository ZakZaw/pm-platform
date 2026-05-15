using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Tasks.Commands;

public record CreateTaskCommand(
    Guid StoryId,
    string Title,
    string? Description,
    string? Priority,
    Guid? AssigneeId,
    Guid? ReviewerId) : IRequest<Result<TaskDto>>;

public class CreateTaskCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(CreateTaskCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is null)
            return Result.Failure<TaskDto>(AuthErrors.NotAuthenticated);

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length < 2 || title.Length > 200)
            return Result.Failure<TaskDto>(TaskErrors.InvalidTitle);

        var priority = Priority.Medium;
        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            if (!Enum.TryParse(request.Priority, ignoreCase: true, out priority))
                return Result.Failure<TaskDto>(TaskErrors.InvalidPriority);
        }

        var task = new TaskEntity
        {
            StoryId = request.StoryId,
            Title = title,
            Description = request.Description,
            Priority = priority,
            Status = DomainTaskStatus.Backlog,
            AssigneeId = request.AssigneeId,
            ReviewerId = request.ReviewerId
        };
        db.Tasks.Add(task);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(task));
    }

    internal static TaskDto ToDto(TaskEntity t) => new(
        t.Id, t.StoryId, t.Title, t.Description,
        t.Status.ToString(), t.AssigneeId, t.ReviewerId,
        t.Priority.ToString(), t.TimeLoggedMinutes, t.PrUrl,
        t.CreatedByAi, t.CreatedAt);
}
