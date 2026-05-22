using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Commands;

/// <summary>
/// Marks a run as Skipped. Requires a non-empty reason so the audit row
/// is meaningful (per F1.5-05 AC); the reason persists on the run itself
/// instead of in ActivityLog because that table isn't built yet.
/// </summary>
public record SkipRunCommand(Guid RunId, string Reason) : IRequest<Result>;

public class SkipRunCommandHandler(IAppDbContext db)
    : IRequestHandler<SkipRunCommand, Result>
{
    public async Task<Result> Handle(SkipRunCommand request, CancellationToken ct)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason))
            return Result.Failure(OperationsErrors.SkipReasonRequired);

        var run = await db.WorkflowRuns.FirstOrDefaultAsync(r => r.Id == request.RunId, ct);
        if (run is null) return Result.Failure(OperationsErrors.RunNotFound);

        if (run.Status is WorkflowRunStatus.Completed or WorkflowRunStatus.Skipped)
            return Result.Failure(OperationsErrors.RunAlreadyTerminal);

        run.Status = WorkflowRunStatus.Skipped;
        run.SkippedReason = reason;
        run.CompletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
