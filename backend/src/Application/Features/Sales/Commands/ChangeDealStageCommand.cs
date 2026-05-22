using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

/// <summary>
/// Moves a deal to a different stage. Terminal stages (won / lost) flip
/// <see cref="Domain.Entities.Deal.Status"/> and stamp ClosedAt; lost
/// stages require a non-empty reason (mirrors the Task → Blocked /
/// WontDo audit-reason rule in the engineering work model).
/// </summary>
public record ChangeDealStageCommand(
    Guid DealId,
    Guid ToStageId,
    string? Reason) : IRequest<Result<DealDto>>;

public class ChangeDealStageCommandHandler(IAppDbContext db)
    : IRequestHandler<ChangeDealStageCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(ChangeDealStageCommand request, CancellationToken ct)
    {
        var deal = await db.Deals.FirstOrDefaultAsync(d => d.Id == request.DealId, ct);
        if (deal is null) return Result.Failure<DealDto>(SalesErrors.DealNotFound);

        var stage = await db.DealStages.FirstOrDefaultAsync(s => s.Id == request.ToStageId, ct);
        if (stage is null) return Result.Failure<DealDto>(SalesErrors.StageNotFound);
        if (stage.ProjectId != deal.ProjectId)
            return Result.Failure<DealDto>(SalesErrors.StageNotInProject);

        if (stage.IsTerminalLost && string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure<DealDto>(SalesErrors.LostReasonRequired);

        deal.StageId = stage.Id;
        // Defer to the stage's default probability when crossing into a
        // new column. Callers that want to keep the old probability can
        // PATCH it back via UpdateDealCommand right after.
        deal.Probability = stage.DefaultProbability;

        if (stage.IsTerminalWon)
        {
            deal.Status = DealStatus.Won;
            deal.ClosedAt = DateTime.UtcNow;
            deal.WonNote = string.IsNullOrWhiteSpace(request.Reason) ? deal.WonNote : request.Reason!.Trim();
            deal.LostReason = null;
        }
        else if (stage.IsTerminalLost)
        {
            deal.Status = DealStatus.Lost;
            deal.ClosedAt = DateTime.UtcNow;
            deal.LostReason = request.Reason!.Trim();
            deal.WonNote = null;
        }
        else
        {
            deal.Status = DealStatus.Open;
            deal.ClosedAt = null;
            deal.LostReason = null;
        }

        await db.SaveChangesAsync(ct);

        var account = await db.Accounts.Where(a => a.Id == deal.AccountId)
            .Select(a => a.Name).FirstAsync(ct);

        return Result.Success(new DealDto(
            deal.Id, deal.ProjectId, deal.AccountId, account,
            deal.Name, deal.Value, deal.Currency,
            deal.StageId, stage.Name, deal.Probability,
            deal.ExpectedClose, deal.OwnerId,
            deal.Status.ToString(), deal.LostReason, deal.WonNote,
            deal.CreatedAt, deal.ClosedAt));
    }
}
