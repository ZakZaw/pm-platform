using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record UpdateCampaignCommand(
    Guid CampaignId,
    string? Name,
    string? Channel,
    DateTime? StartDate,
    bool ClearStartDate,
    DateTime? EndDate,
    bool ClearEndDate,
    string? Status,
    string? GoalMd,
    decimal? BudgetAmount,
    bool ClearBudgetAmount,
    string? BudgetCurrency,
    bool ClearBudgetCurrency,
    Guid? OwnerId,
    bool ClearOwner,
    bool? Archive) : IRequest<Result<CampaignDto>>;

public class UpdateCampaignCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateCampaignCommand, Result<CampaignDto>>
{
    public async Task<Result<CampaignDto>> Handle(UpdateCampaignCommand request, CancellationToken ct)
    {
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == request.CampaignId, ct);
        if (campaign is null) return Result.Failure<CampaignDto>(MarketingErrors.CampaignNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 200)
                return Result.Failure<CampaignDto>(MarketingErrors.InvalidCampaignName);
            campaign.Name = n;
        }
        if (request.Channel is not null)
        {
            if (!Enum.TryParse<MarketingChannel>(request.Channel, ignoreCase: true, out var ch))
                return Result.Failure<CampaignDto>(MarketingErrors.InvalidChannel);
            campaign.Channel = ch;
        }
        if (request.ClearStartDate) campaign.StartDate = null;
        else if (request.StartDate.HasValue) campaign.StartDate = request.StartDate;

        if (request.ClearEndDate) campaign.EndDate = null;
        else if (request.EndDate.HasValue) campaign.EndDate = request.EndDate;

        if (campaign.StartDate is { } s && campaign.EndDate is { } e && e < s)
            return Result.Failure<CampaignDto>(MarketingErrors.InvalidDateRange);

        if (request.Status is not null)
        {
            if (!Enum.TryParse<CampaignStatus>(request.Status, ignoreCase: true, out var st))
                return Result.Failure<CampaignDto>(MarketingErrors.InvalidCampaignStatus);
            campaign.Status = st;
        }
        if (request.GoalMd is not null) campaign.GoalMd = request.GoalMd;

        if (request.ClearBudgetAmount) campaign.BudgetAmount = null;
        else if (request.BudgetAmount.HasValue)
        {
            if (request.BudgetAmount.Value < 0)
                return Result.Failure<CampaignDto>(MarketingErrors.InvalidBudget);
            campaign.BudgetAmount = request.BudgetAmount;
        }

        if (request.ClearBudgetCurrency) campaign.BudgetCurrency = null;
        else if (request.BudgetCurrency is not null)
        {
            var c = request.BudgetCurrency.Trim().ToUpperInvariant();
            if (c.Length != 3) return Result.Failure<CampaignDto>(MarketingErrors.InvalidCurrency);
            campaign.BudgetCurrency = c;
        }

        if (request.ClearOwner) campaign.OwnerId = null;
        else if (request.OwnerId.HasValue) campaign.OwnerId = request.OwnerId;

        if (request.Archive.HasValue)
            campaign.ArchivedAt = request.Archive.Value ? DateTime.UtcNow : null;

        await db.SaveChangesAsync(ct);

        var counts = await db.Assets
            .Where(a => a.CampaignId == campaign.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Published = g.Count(a => a.Status == AssetStatus.Published),
            })
            .FirstOrDefaultAsync(ct);
        var taskCounts = await db.MarketingTasks
            .Where(t => t.CampaignId == campaign.Id)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Done = g.Count(t => t.Status == MarketingTaskStatus.Done),
            })
            .FirstOrDefaultAsync(ct);

        return Result.Success(new CampaignDto(
            campaign.Id, campaign.ProjectId, campaign.Name, campaign.Channel.ToString(),
            campaign.StartDate, campaign.EndDate, campaign.Status.ToString(),
            campaign.GoalMd, campaign.BudgetAmount, campaign.BudgetCurrency,
            campaign.OwnerId, campaign.CreatedAt, campaign.ArchivedAt,
            AssetCount: counts?.Total ?? 0,
            PublishedAssetCount: counts?.Published ?? 0,
            TaskCount: taskCounts?.Total ?? 0,
            DoneTaskCount: taskCounts?.Done ?? 0));
    }
}
