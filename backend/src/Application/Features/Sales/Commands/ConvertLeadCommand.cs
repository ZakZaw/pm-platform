using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

/// <summary>
/// Turns a qualified Lead into a Deal. Creates the Account first if the
/// lead doesn't have one. Marks the lead Converted and stamps its
/// <see cref="Domain.Entities.Lead.ConvertedDealId"/>.
/// </summary>
public record ConvertLeadCommand(
    Guid LeadId,
    string? AccountName,
    string DealName,
    decimal Value,
    string? Currency,
    Guid? StageId) : IRequest<Result<DealDto>>;

public class ConvertLeadCommandHandler(IAppDbContext db)
    : IRequestHandler<ConvertLeadCommand, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(ConvertLeadCommand request, CancellationToken ct)
    {
        var lead = await db.Leads.FirstOrDefaultAsync(l => l.Id == request.LeadId, ct);
        if (lead is null) return Result.Failure<DealDto>(SalesErrors.LeadNotFound);
        if (lead.ConvertedDealId.HasValue || lead.Status == LeadStatus.Converted)
            return Result.Failure<DealDto>(SalesErrors.LeadAlreadyConverted);

        var dealName = request.DealName?.Trim() ?? string.Empty;
        if (dealName.Length is < 1 or > 200)
            return Result.Failure<DealDto>(SalesErrors.InvalidDealName);
        if (request.Value < 0)
            return Result.Failure<DealDto>(SalesErrors.InvalidDealValue);
        var currency = (request.Currency ?? "USD").Trim().ToUpperInvariant();
        if (currency.Length != 3)
            return Result.Failure<DealDto>(SalesErrors.InvalidCurrency);

        // Reuse the lead's existing account, or create one named after
        // the lead (or AccountName override) if the lead is standalone.
        Account account;
        if (lead.AccountId is { } accountId)
        {
            account = (await db.Accounts.FirstOrDefaultAsync(a => a.Id == accountId, ct))!;
            if (account is null) return Result.Failure<DealDto>(SalesErrors.AccountNotFound);
        }
        else
        {
            var accountName = (request.AccountName ?? lead.Name).Trim();
            account = new Account
            {
                ProjectId = lead.ProjectId,
                Name = accountName,
                OwnerId = lead.OwnerId,
            };
            db.Accounts.Add(account);
            lead.AccountId = account.Id;
        }

        DealStage? stage;
        if (request.StageId is { } sid)
        {
            stage = await db.DealStages
                .FirstOrDefaultAsync(s => s.Id == sid && s.ProjectId == lead.ProjectId, ct);
            if (stage is null) return Result.Failure<DealDto>(SalesErrors.StageNotInProject);
        }
        else
        {
            stage = await db.DealStages
                .Where(s => s.ProjectId == lead.ProjectId && !s.IsTerminalWon && !s.IsTerminalLost)
                .OrderBy(s => s.Order)
                .FirstOrDefaultAsync(ct);
            if (stage is null) return Result.Failure<DealDto>(SalesErrors.StageNotFound);
        }

        var deal = new Deal
        {
            ProjectId = lead.ProjectId,
            AccountId = account.Id,
            Name = dealName,
            Value = request.Value,
            Currency = currency,
            StageId = stage.Id,
            Probability = stage.DefaultProbability,
            OwnerId = lead.OwnerId,
            Status = DealStatus.Open,
        };
        db.Deals.Add(deal);

        lead.Status = LeadStatus.Converted;
        lead.ConvertedDealId = deal.Id;
        lead.ConvertedAt = DateTime.UtcNow;

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
