using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Queries;

public record ListTaskDependenciesQuery(Guid TaskId)
    : IRequest<Result<TaskDependencyListDto>>;

public record TaskDependencyListDto(
    /// <summary>Tasks this one is waiting on.</summary>
    IReadOnlyList<TaskDependencyEntryDto> DependsOn,
    /// <summary>Tasks waiting on this one.</summary>
    IReadOnlyList<TaskDependencyEntryDto> Blocking);

public record TaskDependencyEntryDto(
    Guid Id,
    Guid TaskId,
    string Key,
    string Title,
    string Status);

public class ListTaskDependenciesQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskDependenciesQuery, Result<TaskDependencyListDto>>
{
    public async Task<Result<TaskDependencyListDto>> Handle(
        ListTaskDependenciesQuery request, CancellationToken ct)
    {
        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (task is null) return Result.Failure<TaskDependencyListDto>(TaskErrors.NotFound);

        var projectKey = await db.Projects
            .Where(p => p.Id == task.ProjectId)
            .Select(p => p.Key)
            .FirstAsync(ct);

        var dependsOn = await db.TaskDependencies
            .Where(d => d.TaskId == request.TaskId)
            .Select(d => new TaskDependencyEntryDto(
                d.Id, d.DependsOnTaskId,
                projectKey + "-" + d.DependsOnTask.KeyNum,
                d.DependsOnTask.Title,
                d.DependsOnTask.Status.ToString()))
            .ToListAsync(ct);

        var blocking = await db.TaskDependencies
            .Where(d => d.DependsOnTaskId == request.TaskId)
            .Select(d => new TaskDependencyEntryDto(
                d.Id, d.TaskId,
                projectKey + "-" + d.Task.KeyNum,
                d.Task.Title,
                d.Task.Status.ToString()))
            .ToListAsync(ct);

        return Result.Success(new TaskDependencyListDto(dependsOn, blocking));
    }
}
