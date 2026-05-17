using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Workflow.Commands;

/// <summary>
/// Removes a workflow column. Rejected when the project still has tasks
/// in that status bucket — the user must move or close those tasks first.
/// Also rejects if removing this column would leave the project with no
/// done-state columns.
/// </summary>
public record DeleteStatusConfigCommand(Guid ProjectId, Guid ConfigId)
    : IRequest<Result>;

public class DeleteStatusConfigCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteStatusConfigCommand, Result>
{
    public async Task<Result> Handle(DeleteStatusConfigCommand request, CancellationToken ct)
    {
        var config = await db.ProjectStatusConfigs
            .FirstOrDefaultAsync(c => c.Id == request.ConfigId
                                       && c.ProjectId == request.ProjectId, ct);
        if (config is null)
            return Result.Failure(WorkflowErrors.ConfigNotFound);

        // Only the LAST column mapped to a given enum bucket is allowed to
        // block deletion on task count — earlier aliases share the bucket.
        var otherAliases = await db.ProjectStatusConfigs
            .CountAsync(c => c.ProjectId == request.ProjectId
                              && c.Status == config.Status
                              && c.Id != config.Id, ct);
        if (otherAliases == 0)
        {
            var tasksInStatus = await db.Tasks
                .CountAsync(t => t.ProjectId == request.ProjectId && t.Status == config.Status, ct);
            if (tasksInStatus > 0)
                return Result.Failure(WorkflowErrors.ColumnNotEmpty);
        }

        if (config.IsDoneState)
        {
            var otherDoneStates = await db.ProjectStatusConfigs
                .CountAsync(c => c.ProjectId == request.ProjectId
                                  && c.Id != config.Id
                                  && c.IsDoneState, ct);
            if (otherDoneStates == 0)
                return Result.Failure(WorkflowErrors.NeedOneDoneState);
        }

        db.ProjectStatusConfigs.Remove(config);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
