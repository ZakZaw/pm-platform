using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Lists.Commands;

public record CreateTaskListCommand(Guid ProjectId, string Name)
    : IRequest<Result<TaskListDto>>;

public class CreateTaskListCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateTaskListCommand, Result<TaskListDto>>
{
    public async Task<Result<TaskListDto>> Handle(CreateTaskListCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 120)
            return Result.Failure<TaskListDto>(TaskListErrors.InvalidName);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<TaskListDto>(ProjectErrors.NotFound);

        var nextOrder = 1 + await db.TaskLists
            .Where(l => l.ProjectId == request.ProjectId)
            .Select(l => (int?)l.Order)
            .MaxAsync(ct) ?? 1;

        var list = new TaskList
        {
            ProjectId = request.ProjectId,
            Name = name,
            Order = nextOrder,
        };
        db.TaskLists.Add(list);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TaskListDto(
            list.Id, list.ProjectId, list.Name, list.Order, list.CreatedAt,
            TaskCount: 0, CompletedTaskCount: 0));
    }
}
