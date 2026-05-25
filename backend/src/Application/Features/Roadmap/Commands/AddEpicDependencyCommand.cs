using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record AddEpicDependencyCommand(
    Guid EpicId,
    Guid DependsOnEpicId) : IRequest<Result<EpicDependencyDto>>;

public record EpicDependencyDto(Guid Id, Guid EpicId, Guid DependsOnEpicId);

public class AddEpicDependencyCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<AddEpicDependencyCommand, Result<EpicDependencyDto>>
{
    public async Task<Result<EpicDependencyDto>> Handle(AddEpicDependencyCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<EpicDependencyDto>(AuthErrors.NotAuthenticated);

        var epic = await db.Epics
            .Where(e => e.Id == request.EpicId)
            .Select(e => new { e.Id, e.ProjectId, e.Title })
            .FirstOrDefaultAsync(ct);
        if (epic is null) return Result.Failure<EpicDependencyDto>(EpicErrors.NotFound);

        var prereq = await db.Epics
            .Where(e => e.Id == request.DependsOnEpicId)
            .Select(e => new { e.Id, e.ProjectId, e.Title })
            .FirstOrDefaultAsync(ct);
        if (prereq is null) return Result.Failure<EpicDependencyDto>(EpicErrors.NotFound);

        if (epic.ProjectId != prereq.ProjectId)
            return Result.Failure<EpicDependencyDto>(EpicErrors.DependencyNotInProject);

        // Cycle guard: fetch all existing edges in the project and check
        // whether the new one would close a loop.
        var existing = await db.EpicDependencies
            .Where(d => d.Epic.ProjectId == epic.ProjectId)
            .Select(d => new { d.EpicId, d.DependsOnEpicId })
            .ToListAsync(ct);

        var edges = existing.Select(e => (e.EpicId, e.DependsOnEpicId)).ToList();
        if (EpicDependencyGraph.WouldCreateCycle(edges, epic.Id, prereq.Id))
            return Result.Failure<EpicDependencyDto>(EpicErrors.DependencyCycle);

        // Idempotent on the unique (EpicId, DependsOnEpicId) pair.
        var already = existing.Any(e => e.EpicId == epic.Id && e.DependsOnEpicId == prereq.Id);
        if (already)
        {
            var current = await db.EpicDependencies
                .Where(d => d.EpicId == epic.Id && d.DependsOnEpicId == prereq.Id)
                .Select(d => new EpicDependencyDto(d.Id, d.EpicId, d.DependsOnEpicId))
                .FirstAsync(ct);
            return Result.Success(current);
        }

        var dep = new EpicDependency
        {
            EpicId = epic.Id,
            DependsOnEpicId = prereq.Id,
        };
        db.EpicDependencies.Add(dep);

        var orgId = await db.Projects
            .Where(p => p.Id == epic.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

        activity.Record(
            orgId: orgId,
            projectId: epic.ProjectId,
            actorId: userId,
            verb: ActivityVerb.EpicDependencyAdded,
            targetType: "Epic",
            targetId: epic.Id,
            summary: $"{epic.Title} now depends on {prereq.Title}",
            metadata: new { dependsOnEpicId = prereq.Id });

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(epic.ProjectId, ProjectEvents.EpicDependencyAdded, new
        {
            epicId = epic.Id, dependsOnEpicId = prereq.Id,
        }, ct);

        return Result.Success(new EpicDependencyDto(dep.Id, dep.EpicId, dep.DependsOnEpicId));
    }
}

public record RemoveEpicDependencyCommand(
    Guid EpicId,
    Guid DependsOnEpicId) : IRequest<Result>;

public class RemoveEpicDependencyCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<RemoveEpicDependencyCommand, Result>
{
    public async Task<Result> Handle(RemoveEpicDependencyCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var dep = await db.EpicDependencies
            .FirstOrDefaultAsync(d => d.EpicId == request.EpicId && d.DependsOnEpicId == request.DependsOnEpicId, ct);
        if (dep is null) return Result.Failure(EpicErrors.DependencyNotFound);

        var epic = await db.Epics
            .Where(e => e.Id == request.EpicId)
            .Select(e => new { e.ProjectId, e.Title })
            .FirstAsync(ct);
        var prereqTitle = await db.Epics
            .Where(e => e.Id == request.DependsOnEpicId)
            .Select(e => e.Title)
            .FirstAsync(ct);
        var orgId = await db.Projects
            .Where(p => p.Id == epic.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

        db.EpicDependencies.Remove(dep);
        activity.Record(
            orgId: orgId,
            projectId: epic.ProjectId,
            actorId: userId,
            verb: ActivityVerb.EpicDependencyRemoved,
            targetType: "Epic",
            targetId: request.EpicId,
            summary: $"removed dependency: {epic.Title} no longer waits on {prereqTitle}",
            metadata: new { dependsOnEpicId = request.DependsOnEpicId });
        await db.SaveChangesAsync(ct);

        await events.PublishAsync(epic.ProjectId, ProjectEvents.EpicDependencyRemoved, new
        {
            epicId = request.EpicId, dependsOnEpicId = request.DependsOnEpicId,
        }, ct);
        return Result.Success();
    }
}
