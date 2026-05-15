using Application.Common;
using Application.Features.Subtasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Subtasks.Queries;

public record ListTaskSubtasksQuery(Guid TaskId) : IRequest<Result<IReadOnlyList<SubtaskDto>>>;

public class ListTaskSubtasksQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskSubtasksQuery, Result<IReadOnlyList<SubtaskDto>>>
{
    public async Task<Result<IReadOnlyList<SubtaskDto>>> Handle(ListTaskSubtasksQuery request, CancellationToken ct)
    {
        var subs = await db.Subtasks
            .Where(s => s.TaskId == request.TaskId)
            .OrderBy(s => s.Order)
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<SubtaskDto>>(
            subs.Select(CreateSubtaskCommandHandler.ToDto).ToList());
    }
}
