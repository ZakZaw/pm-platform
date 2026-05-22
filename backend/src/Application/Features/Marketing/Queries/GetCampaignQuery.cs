using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Queries;

public record GetCampaignQuery(Guid CampaignId) : IRequest<Result<CampaignDetailDto>>;

public class GetCampaignQueryHandler(IAppDbContext db)
    : IRequestHandler<GetCampaignQuery, Result<CampaignDetailDto>>
{
    public async Task<Result<CampaignDetailDto>> Handle(GetCampaignQuery request, CancellationToken ct)
    {
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == request.CampaignId, ct);
        if (campaign is null)
            return Result.Failure<CampaignDetailDto>(MarketingErrors.CampaignNotFound);

        var assetRows = await db.Assets
            .Where(a => a.CampaignId == campaign.Id)
            .OrderBy(a => a.PublishDate == null)
            .ThenBy(a => a.PublishDate)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        var assetTitles = assetRows.ToDictionary(a => a.Id, a => a.Title);

        var assetDtos = assetRows.Select(a => new AssetDto(
            a.Id, a.CampaignId, campaign.Name, campaign.Channel.ToString(),
            a.Type.ToString(), a.Title, a.Status.ToString(),
            a.PublishDate, a.OwnerId, a.FileUrl, a.BodyMd,
            a.RejectionReason, a.CreatedAt, a.UpdatedAt)).ToList();

        var taskRows = await db.MarketingTasks
            .Where(t => t.CampaignId == campaign.Id)
            .OrderBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var taskDtos = taskRows.Select(t => new MarketingTaskDto(
            t.Id, t.CampaignId, campaign.Name,
            t.AssetId,
            t.AssetId.HasValue && assetTitles.TryGetValue(t.AssetId.Value, out var title) ? title : null,
            t.Title, t.Status.ToString(),
            t.AssigneeId, t.DueDate, t.CreatedAt)).ToList();

        var dto = new CampaignDto(
            campaign.Id, campaign.ProjectId, campaign.Name, campaign.Channel.ToString(),
            campaign.StartDate, campaign.EndDate, campaign.Status.ToString(),
            campaign.GoalMd, campaign.BudgetAmount, campaign.BudgetCurrency,
            campaign.OwnerId, campaign.CreatedAt, campaign.ArchivedAt,
            AssetCount: assetDtos.Count,
            PublishedAssetCount: assetDtos.Count(a => a.Status == nameof(AssetStatus.Published)),
            TaskCount: taskDtos.Count,
            DoneTaskCount: taskDtos.Count(t => t.Status == nameof(MarketingTaskStatus.Done)));

        return Result.Success(new CampaignDetailDto(dto, assetDtos, taskDtos));
    }
}
