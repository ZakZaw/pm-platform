using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Commands;

/// <summary>Marks a Pending run as InProgress and stamps StartedAt.
/// No-op if the run is already in progress.</summary>
public record StartRunCommand(Guid RunId) : IRequest<Result>;

public class StartRunCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<StartRunCommand, Result>
{
    public async Task<Result> Handle(StartRunCommand request, CancellationToken ct)
    {
        var run = await db.WorkflowRuns.FirstOrDefaultAsync(r => r.Id == request.RunId, ct);
        if (run is null) return Result.Failure(OperationsErrors.RunNotFound);

        if (run.Status is WorkflowRunStatus.Completed or WorkflowRunStatus.Skipped)
            return Result.Failure(OperationsErrors.RunAlreadyTerminal);

        if (run.Status == WorkflowRunStatus.Pending)
        {
            run.Status = WorkflowRunStatus.InProgress;
            run.StartedAt = DateTime.UtcNow;
            if (run.OwnerId is null) run.OwnerId = currentUser.UserId;
            await db.SaveChangesAsync(ct);
        }
        return Result.Success();
    }
}
