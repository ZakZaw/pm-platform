using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record UpdateDealCommand(
    Guid DealId,
    string? Name,
    decimal? Value,
    string? Currency,
    int? Probability,
    DateTime? ExpectedClose,
    Guid? OwnerId,
    string? WonNote) : IRequest<Result<DealDto>>;

public class UpdateDealCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateDealCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(UpdateDealCommand request, CancellationToken ct)
    {
        var deal = await db.Deals.FirstOrDefaultAsync(d => d.Id == request.DealId, ct);
        if (deal is null) return Result.Failure<DealDto>(SalesErrors.DealNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<DealDto>(SalesErrors.InvalidDealName);
            deal.Name = n;
        }
        if (request.Value is { } v)
        {
            if (v < 0) return Result.Failure<DealDto>(SalesErrors.InvalidDealValue);
            deal.Value = v;
        }
        if (request.Currency is not null)
        {
            var c = request.Currency.Trim().ToUpperInvariant();
            if (c.Length != 3) return Result.Failure<DealDto>(SalesErrors.InvalidCurrency);
            deal.Currency = c;
        }
        if (request.Probability is { } p)
        {
            if (p is < 0 or > 100) return Result.Failure<DealDto>(SalesErrors.InvalidProbability);
            deal.Probability = p;
        }
        if (request.ExpectedClose.HasValue) deal.ExpectedClose = request.ExpectedClose;
        if (request.OwnerId.HasValue) deal.OwnerId = request.OwnerId;
        if (request.WonNote is not null) deal.WonNote = request.WonNote;

        await db.SaveChangesAsync(ct);

        var account = await db.Accounts.Where(a => a.Id == deal.AccountId)
            .Select(a => a.Name).FirstAsync(ct);
        var stage = await db.DealStages.Where(s => s.Id == deal.StageId)
            .Select(s => s.Name).FirstAsync(ct);

        return Result.Success(new DealDto(
            deal.Id, deal.ProjectId, deal.AccountId, account,
            deal.Name, deal.Value, deal.Currency,
            deal.StageId, stage, deal.Probability,
            deal.ExpectedClose, deal.OwnerId,
            deal.Status.ToString(), deal.LostReason, deal.WonNote,
            deal.CreatedAt, deal.ClosedAt));
    }
}
