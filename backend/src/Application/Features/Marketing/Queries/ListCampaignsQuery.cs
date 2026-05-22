using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Queries;

public record ListCampaignsQuery(Guid ProjectId, bool IncludeArchived = false)
    : IRequest<Result<IReadOnlyList<CampaignDto>>>;

public class ListCampaignsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListCampaignsQuery, Result<IReadOnlyList<CampaignDto>>>
{
    public async Task<Result<IReadOnlyList<CampaignDto>>> Handle(
        ListCampaignsQuery request, CancellationToken ct)
    {
        var query = db.Campaigns.Where(c => c.ProjectId == request.ProjectId);
        if (!request.IncludeArchived) query = query.Where(c => c.ArchivedAt == null);

        var campaigns = await query
            .OrderBy(c => c.StartDate == null)
            .ThenBy(c => c.StartDate)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        var campaignIds = campaigns.Select(c => c.Id).ToList();

        var assetGroups = await db.Assets
            .Where(a => campaignIds.Contains(a.CampaignId))
            .GroupBy(a => a.CampaignId)
            .Select(g => new
            {
                CampaignId = g.Key,
                Total = g.Count(),
                Published = g.Count(a => a.Status == AssetStatus.Published),
            })
            .ToDictionaryAsync(x => x.CampaignId, ct);

        var taskGroups = await db.MarketingTasks
            .Where(t => campaignIds.Contains(t.CampaignId))
            .GroupBy(t => t.CampaignId)
            .Select(g => new
            {
                CampaignId = g.Key,
                Total = g.Count(),
                Done = g.Count(t => t.Status == MarketingTaskStatus.Done),
            })
            .ToDictionaryAsync(x => x.CampaignId, ct);

        var dtos = campaigns.Select(c =>
        {
            var ac = assetGroups.GetValueOrDefault(c.Id);
            var tc = taskGroups.GetValueOrDefault(c.Id);
            return new CampaignDto(
                c.Id, c.ProjectId, c.Name, c.Channel.ToString(),
                c.StartDate, c.EndDate, c.Status.ToString(),
                c.GoalMd, c.BudgetAmount, c.BudgetCurrency,
                c.OwnerId, c.CreatedAt, c.ArchivedAt,
                AssetCount: ac?.Total ?? 0,
                PublishedAssetCount: ac?.Published ?? 0,
                TaskCount: tc?.Total ?? 0,
                DoneTaskCount: tc?.Done ?? 0);
        }).ToList();

        return Result.Success<IReadOnlyList<CampaignDto>>(dtos);
    }
}
