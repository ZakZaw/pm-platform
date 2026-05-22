using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record CreateDealCommand(
    Guid ProjectId,
    Guid AccountId,
    string Name,
    decimal Value,
    string? Currency,
    Guid? StageId,
    int? Probability,
    DateTime? ExpectedClose,
    Guid? OwnerId) : IRequest<Result<DealDto>>;

public class CreateDealCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<DealDto>(SalesErrors.InvalidDealName);
        if (request.Value < 0)
            return Result.Failure<DealDto>(SalesErrors.InvalidDealValue);

        var currency = (request.Currency ?? "USD").Trim().ToUpperInvariant();
        if (currency.Length != 3)
            return Result.Failure<DealDto>(SalesErrors.InvalidCurrency);

        var account = await db.Accounts
            .Where(a => a.Id == request.AccountId)
            .Select(a => new { a.Id, a.ProjectId, a.Name })
            .FirstOrDefaultAsync(ct);
        if (account is null) return Result.Failure<DealDto>(SalesErrors.AccountNotFound);
        if (account.ProjectId != request.ProjectId)
            return Result.Failure<DealDto>(SalesErrors.AccountNotInProject);

        // Either the caller picks a stage explicitly or we default to the
        // first non-terminal stage in the pipeline.
        DealStage? stage;
        if (request.StageId is { } sid)
        {
            stage = await db.DealStages
                .FirstOrDefaultAsync(s => s.Id == sid && s.ProjectId == request.ProjectId, ct);
            if (stage is null) return Result.Failure<DealDto>(SalesErrors.StageNotInProject);
        }
        else
        {
            stage = await db.DealStages
                .Where(s => s.ProjectId == request.ProjectId && !s.IsTerminalWon && !s.IsTerminalLost)
                .OrderBy(s => s.Order)
                .FirstOrDefaultAsync(ct);
            if (stage is null) return Result.Failure<DealDto>(SalesErrors.StageNotFound);
        }

        var probability = request.Probability ?? stage.DefaultProbability;
        if (probability is < 0 or > 100)
            return Result.Failure<DealDto>(SalesErrors.InvalidProbability);

        var status = stage.IsTerminalWon ? DealStatus.Won
            : stage.IsTerminalLost ? DealStatus.Lost
            : DealStatus.Open;

        var deal = new Deal
        {
            ProjectId = request.ProjectId,
            AccountId = account.Id,
            Name = name,
            Value = request.Value,
            Currency = currency,
            StageId = stage.Id,
            Probability = probability,
            ExpectedClose = request.ExpectedClose,
            OwnerId = request.OwnerId,
            Status = status,
            ClosedAt = status == DealStatus.Open ? null : DateTime.UtcNow,
        };
        db.Deals.Add(deal);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DealDto(
            deal.Id, deal.ProjectId, deal.AccountId, account.Name,
            deal.Name, deal.Value, deal.Currency,
            deal.StageId, stage.Name, deal.Probability,
            deal.ExpectedClose, deal.OwnerId,
            deal.Status.ToString(), deal.LostReason, deal.WonNote,
            deal.CreatedAt, deal.ClosedAt));
    }
}
