using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Lists.Commands;

public record UpdateTaskListCommand(Guid ListId, string? Name)
    : IRequest<Result<TaskListDto>>;

public class UpdateTaskListCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateTaskListCommand, Result<TaskListDto>>
{
    public async Task<Result<TaskListDto>> Handle(UpdateTaskListCommand request, CancellationToken ct)
    {
        var list = await db.TaskLists.FirstOrDefaultAsync(l => l.Id == request.ListId, ct);
        if (list is null) return Result.Failure<TaskListDto>(TaskListErrors.NotFound);

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length is < 1 or > 120)
                return Result.Failure<TaskListDto>(TaskListErrors.InvalidName);
            list.Name = name;
        }

        await db.SaveChangesAsync(ct);

        var counts = await db.Tasks
            .Where(t => t.TaskListId == list.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Done = g.Count(t => t.Status == Domain.Enums.TaskStatus.Done),
            })
            .FirstOrDefaultAsync(ct);

        return Result.Success(new TaskListDto(
            list.Id, list.ProjectId, list.Name, list.Order, list.CreatedAt,
            TaskCount: counts?.Total ?? 0,
            CompletedTaskCount: counts?.Done ?? 0));
    }
}
