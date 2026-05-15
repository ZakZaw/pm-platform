using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Subtasks.Commands;

public record UpdateSubtaskCommand(
    Guid SubtaskId,
    string? Title,
    bool? Completed,
    Guid? AssigneeId) : IRequest<Result<SubtaskDto>>;

public class UpdateSubtaskCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateSubtaskCommand, Result<SubtaskDto>>
{
    public async Task<Result<SubtaskDto>> Handle(UpdateSubtaskCommand request, CancellationToken ct)
    {
        var sub = await db.Subtasks.FirstOrDefaultAsync(s => s.Id == request.SubtaskId, ct);
        if (sub is null)
            return Result.Failure<SubtaskDto>(SubtaskErrors.NotFound);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length is < 1 or > 200)
                return Result.Failure<SubtaskDto>(SubtaskErrors.InvalidTitle);
            sub.Title = t;
        }

        if (request.Completed.HasValue) sub.Completed = request.Completed.Value;
        if (request.AssigneeId.HasValue) sub.AssigneeId = request.AssigneeId;

        await db.SaveChangesAsync(ct);
        return Result.Success(CreateSubtaskCommandHandler.ToDto(sub));
    }
}
