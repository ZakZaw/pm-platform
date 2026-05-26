using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Commands;

public record AddTaskDependencyCommand(Guid TaskId, Guid DependsOnTaskId)
    : IRequest<Result<TaskDependencyDto>>;

public record TaskDependencyDto(
    Guid Id, Guid TaskId, Guid DependsOnTaskId, DateTime CreatedAt);

public class AddTaskDependencyCommandHandler(IAppDbContext db)
    : IRequestHandler<AddTaskDependencyCommand, Result<TaskDependencyDto>>
{
    public async Task<Result<TaskDependencyDto>> Handle(
        AddTaskDependencyCommand request, CancellationToken ct)
    {
        if (request.TaskId == request.DependsOnTaskId)
            return Result.Failure<TaskDependencyDto>(TaskErrors.DependencyCycle);

        var pair = await db.Tasks
            .Where(t => t.Id == request.TaskId || t.Id == request.DependsOnTaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .ToListAsync(ct);
        if (pair.Count != 2) return Result.Failure<TaskDependencyDto>(TaskErrors.NotFound);
        if (pair[0].ProjectId != pair[1].ProjectId)
            return Result.Failure<TaskDependencyDto>(TaskErrors.DependencyNotInProject);

        var projectId = pair[0].ProjectId;

        // Cycle detection reuses EpicDependencyGraph since the algorithm is
        // pure on opaque GUID edges. Pulls the full per-project edge set so
        // the BFS sees existing chains. This stays cheap until we hit
        // thousand-task projects.
        var edges = await db.TaskDependencies
            .Where(d => d.Task.ProjectId == projectId)
            .Select(d => new { d.TaskId, d.DependsOnTaskId })
            .ToListAsync(ct);
        var edgeList = edges.Select(e => (e.TaskId, e.DependsOnTaskId)).ToList();
        if (EpicDependencyGraph.WouldCreateCycle(edgeList, request.TaskId, request.DependsOnTaskId))
            return Result.Failure<TaskDependencyDto>(TaskErrors.DependencyCycle);

        // Idempotent — same edge twice returns the existing row instead of
        // tripping the unique index.
        var existing = await db.TaskDependencies
            .FirstOrDefaultAsync(d =>
                d.TaskId == request.TaskId &&
                d.DependsOnTaskId == request.DependsOnTaskId, ct);
        if (existing is not null)
        {
            return Result.Success(new TaskDependencyDto(
                existing.Id, existing.TaskId, existing.DependsOnTaskId, existing.CreatedAt));
        }

        var dep = new TaskDependency
        {
            TaskId = request.TaskId,
            DependsOnTaskId = request.DependsOnTaskId,
        };
        db.TaskDependencies.Add(dep);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TaskDependencyDto(
            dep.Id, dep.TaskId, dep.DependsOnTaskId, dep.CreatedAt));
    }
}

public record RemoveTaskDependencyCommand(Guid TaskId, Guid DependsOnTaskId)
    : IRequest<Result>;

public class RemoveTaskDependencyCommandHandler(IAppDbContext db)
    : IRequestHandler<RemoveTaskDependencyCommand, Result>
{
    public async Task<Result> Handle(RemoveTaskDependencyCommand request, CancellationToken ct)
    {
        var dep = await db.TaskDependencies.FirstOrDefaultAsync(d =>
            d.TaskId == request.TaskId &&
            d.DependsOnTaskId == request.DependsOnTaskId, ct);
        if (dep is null) return Result.Failure(TaskErrors.DependencyNotFound);

        db.TaskDependencies.Remove(dep);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
