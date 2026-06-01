using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Marketing project dashboard analytics — active campaigns with asset
/// progress, the channel mix, assets due in the next 7 days, and the weekly
/// publish throughput trend. Weekly bucketing lives in the pure
/// <see cref="ThroughputCalculator"/>.
/// </summary>
public record GetMarketingAnalyticsQuery(Guid ProjectId) : IRequest<Result<MarketingAnalyticsDto>>;

public class GetMarketingAnalyticsQueryHandler(IAppDbContext db)
    : IRequestHandler<GetMarketingAnalyticsQuery, Result<MarketingAnalyticsDto>>
{
    private const int ThroughputWeeks = 8;
    private const int MaxActiveCampaigns = 6;
    private const int MaxDue = 6;
    private const int DueWindowDays = 7;

    public async Task<Result<MarketingAnalyticsDto>> Handle(GetMarketingAnalyticsQuery request, CancellationToken ct)
    {
        var campaigns = await db.Campaigns
            .Where(c => c.ProjectId == request.ProjectId && c.ArchivedAt == null)
            .Select(c => new { c.Id, c.Name, c.Channel, c.Status })
            .ToListAsync(ct);

        var assets = await db.Assets
            .Where(a => a.Campaign.ProjectId == request.ProjectId)
            .Select(a => new { a.Id, a.Title, a.CampaignId, a.Status, a.PublishDate })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;

        var activeCampaigns = campaigns
            .Where(c => c.Status is CampaignStatus.Planning or CampaignStatus.Active)
            .ToList();

        var assetsByCampaign = assets
            .GroupBy(a => a.CampaignId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var activeDtos = activeCampaigns
            .Select(c =>
            {
                var owned = assetsByCampaign.GetValueOrDefault(c.Id, []);
                return new MarketingCampaignDto(
                    c.Id, c.Name, owned.Count, owned.Count(a => a.Status == AssetStatus.Published));
            })
            .OrderByDescending(c => c.AssetCount)
            .Take(MaxActiveCampaigns)
            .ToList();

        var channelMix = campaigns
            .GroupBy(c => c.Channel)
            .Select(g => new MarketingChannelDto(g.Key.ToString(), g.Count()))
            .OrderByDescending(c => c.Count)
            .ToList();

        // Throughput: published assets bucketed by their publish date.
        var published = assets
            .Where(a => a.Status == AssetStatus.Published && a.PublishDate is not null)
            .Select(a => a.PublishDate!.Value)
            .ToList();
        var throughput = ThroughputCalculator.Weekly(published, now, ThroughputWeeks)
            .Select(w => new ThroughputWeekDto(w.WeekStart, w.Count))
            .ToList();
        var publishedLast30 = published.Count(d => d >= now.AddDays(-30) && d <= now);

        var dueCutoff = now.AddDays(DueWindowDays);
        var dueThisWeek = assets
            .Where(a => a.Status != AssetStatus.Published && a.Status != AssetStatus.Archived
                        && a.PublishDate is { } d && d >= now && d <= dueCutoff)
            .OrderBy(a => a.PublishDate)
            .Take(MaxDue)
            .Select(a => new MarketingAssetDueDto(a.Id, a.Title, a.PublishDate))
            .ToList();

        return Result.Success(new MarketingAnalyticsDto(
            activeCampaigns.Count,
            publishedLast30,
            throughput,
            activeDtos,
            channelMix,
            dueThisWeek));
    }
}
