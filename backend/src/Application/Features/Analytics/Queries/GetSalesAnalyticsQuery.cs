using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Sales project dashboard analytics — open pipeline value, the
/// probability-weighted forecast, the stage funnel with conversion, recent
/// win rate, and the at-risk deal list. Funnel + forecast math lives in the
/// pure <see cref="SalesFunnelCalculator"/>.
/// </summary>
public record GetSalesAnalyticsQuery(Guid ProjectId) : IRequest<Result<SalesAnalyticsDto>>;

public class GetSalesAnalyticsQueryHandler(IAppDbContext db)
    : IRequestHandler<GetSalesAnalyticsQuery, Result<SalesAnalyticsDto>>
{
    // "At risk": low-probability deals whose expected close is imminent.
    private const int AtRiskProbability = 30;
    private const int AtRiskWindowDays = 14;
    private const int MaxAtRisk = 6;
    private const int WinRateWindowDays = 90;

    public async Task<Result<SalesAnalyticsDto>> Handle(GetSalesAnalyticsQuery request, CancellationToken ct)
    {
        var stages = await db.DealStages
            .Where(s => s.ProjectId == request.ProjectId)
            .OrderBy(s => s.Order)
            .Select(s => new { s.Id, s.Name, s.IsTerminalWon, s.IsTerminalLost })
            .ToListAsync(ct);

        var deals = await db.Deals
            .Where(d => d.ProjectId == request.ProjectId)
            .Select(d => new
            {
                d.Id, d.Name, d.StageId, d.Status, d.Value, d.Currency,
                d.Probability, d.ExpectedClose, d.ClosedAt,
            })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var stageName = stages.ToDictionary(s => s.Id, s => s.Name);

        var openDeals = deals.Where(d => d.Status == DealStatus.Open).ToList();
        var currency = openDeals.Select(d => d.Currency).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)) ?? "USD";

        var openPipeline = openDeals.Sum(d => d.Value);
        var weighted = SalesFunnelCalculator.WeightedForecast(
            openDeals.Select(d => (d.Value, d.Probability)));

        // Funnel over the non-terminal stages only — terminal Won/Lost are the
        // outcome, not a step the open pipeline flows through.
        var funnelInputs = stages
            .Where(s => !s.IsTerminalWon && !s.IsTerminalLost)
            .Select(s =>
            {
                var inStage = openDeals.Where(d => d.StageId == s.Id).ToList();
                return new SalesFunnelCalculator.StageInput(s.Name, inStage.Count, inStage.Sum(d => d.Value));
            })
            .ToList();
        var funnel = SalesFunnelCalculator.Funnel(funnelInputs)
            .Select(f => new SalesFunnelStageDto(f.Name, f.Count, f.Value, f.ConversionPct))
            .ToList();

        // Recent close performance (trailing window).
        var cutoff = now.AddDays(-WinRateWindowDays);
        var recentlyClosed = deals.Where(d => d.ClosedAt is { } c && c >= cutoff).ToList();
        var won = recentlyClosed.Where(d => d.Status == DealStatus.Won).ToList();
        var lostCount = recentlyClosed.Count(d => d.Status == DealStatus.Lost);

        var dueCutoff = now.AddDays(AtRiskWindowDays);
        var atRisk = openDeals
            .Where(d => d.Probability < AtRiskProbability
                        && d.ExpectedClose is { } close && close <= dueCutoff)
            .OrderBy(d => d.ExpectedClose)
            .Take(MaxAtRisk)
            .Select(d => new SalesDealAtRiskDto(
                d.Id, d.Name, stageName.GetValueOrDefault(d.StageId, "—"),
                d.Probability, d.Value, d.Currency, d.ExpectedClose))
            .ToList();

        return Result.Success(new SalesAnalyticsDto(
            currency,
            openPipeline,
            weighted,
            won.Sum(d => d.Value),
            won.Count,
            lostCount,
            SalesFunnelCalculator.WinRatePct(won.Count, lostCount),
            funnel,
            atRisk));
    }
}
