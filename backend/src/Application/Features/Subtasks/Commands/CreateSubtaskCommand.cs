using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Subtasks.Commands;

public record CreateSubtaskCommand(Guid TaskId, string Title, Guid? AssigneeId)
    : IRequest<Result<SubtaskDto>>;

public class CreateSubtaskCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateSubtaskCommand, Result<SubtaskDto>>
{
    public async Task<Result<SubtaskDto>> Handle(CreateSubtaskCommand request, CancellationToken ct)
    {
        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length is < 1 or > 200)
            return Result.Failure<SubtaskDto>(SubtaskErrors.InvalidTitle);

        var maxOrder = await db.Subtasks
            .Where(s => s.TaskId == request.TaskId)
            .Select(s => (int?)s.Order)
            .MaxAsync(ct) ?? 0;

        var sub = new Subtask
        {
            TaskId = request.TaskId,
            Title = title,
            AssigneeId = request.AssigneeId,
            Order = maxOrder + 1
        };
        db.Subtasks.Add(sub);
        await db.SaveChangesAsync(ct);
        return Result.Success(ToDto(sub));
    }

    internal static SubtaskDto ToDto(Subtask s) => new(
        s.Id, s.TaskId, s.Title, s.Completed, s.AssigneeId, s.Order, s.CreatedAt);
}
