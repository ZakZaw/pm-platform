using Application.Common;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Queries;

public record GetTaskQuery(Guid TaskId) : IRequest<Result<TaskDto>>;

public class GetTaskQueryHandler(IAppDbContext db)
    : IRequestHandler<GetTaskQuery, Result<TaskDto>>
{
    public async Task<Result<TaskDto>> Handle(GetTaskQuery request, CancellationToken ct)
    {
        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null)
            return Result.Failure<TaskDto>(TaskErrors.NotFound);
        var projectKey = await db.Projects
            .Where(p => p.Id == task.ProjectId)
            .Select(p => p.Key)
            .FirstAsync(ct);
        return Result.Success(CreateTaskCommandHandler.ToDto(task, projectKey));
    }
}
