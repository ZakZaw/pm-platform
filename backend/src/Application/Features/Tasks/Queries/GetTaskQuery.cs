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
        return task is null
            ? Result.Failure<TaskDto>(TaskErrors.NotFound)
            : Result.Success(CreateTaskCommandHandler.ToDto(task));
    }
}
