using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Commands;

public record UpdateTaskCommand(
    Guid TaskId,
    string? Title,
    string? Description,
    string? Priority,
    Guid? AssigneeId,
    Guid? ReviewerId,
    int? TimeLoggedMinutes,
    string? PrUrl) : IRequest<Result<TaskDto>>;

public class UpdateTaskCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateTaskCommand, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(UpdateTaskCommand request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length < 2 || t.Length > 200)
                return Result.Failure<TaskDto>(TaskErrors.InvalidTitle);
            task.Title = t;
        }

        if (request.Description is not null) task.Description = request.Description;
        if (request.AssigneeId.HasValue) task.AssigneeId = request.AssigneeId;
        if (request.ReviewerId.HasValue) task.ReviewerId = request.ReviewerId;
        if (request.TimeLoggedMinutes.HasValue) task.TimeLoggedMinutes = request.TimeLoggedMinutes.Value;
        if (request.PrUrl is not null) task.PrUrl = request.PrUrl;

        if (request.Priority is not null)
        {
            if (!Enum.TryParse<Priority>(request.Priority, ignoreCase: true, out var priority))
                return Result.Failure<TaskDto>(TaskErrors.InvalidPriority);
            task.Priority = priority;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(CreateTaskCommandHandler.ToDto(task));
    }
}
