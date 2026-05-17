using Application.Common;
using Application.Features.Tasks.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Tasks.Queries;

public record ListProjectTasksQuery(
    Guid ProjectId,
    Guid? EpicId,
    Guid? SprintId,
    Guid? AssigneeId,
    bool IncludeDone) : IRequest<Result<IReadOnlyList<TaskDto>>>;

public class ListProjectTasksQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectTasksQuery, Result<IReadOnlyList<TaskDto>>>
{
    public async Task<Result<IReadOnlyList<TaskDto>>> Handle(ListProjectTasksQuery request, CancellationToken ct)
    {
        var q = db.Tasks.Where(t => t.ProjectId == request.ProjectId);
        if (request.EpicId.HasValue) q = q.Where(t => t.EpicId == request.EpicId);
        if (request.SprintId.HasValue) q = q.Where(t => t.SprintId == request.SprintId);
        if (request.AssigneeId.HasValue) q = q.Where(t => t.AssigneeId == request.AssigneeId);
        if (!request.IncludeDone)
            q = q.Where(t => t.Status != DomainTaskStatus.Done && t.Status != DomainTaskStatus.WontDo);

        var tasks = await q
            .OrderBy(t => t.PriorityOrder)
            .ThenBy(t => t.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<TaskDto>>(
            tasks.Select(CreateTaskCommandHandler.ToDto).ToList());
    }
}
