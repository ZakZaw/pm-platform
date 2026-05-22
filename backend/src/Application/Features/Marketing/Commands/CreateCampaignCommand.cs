using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;

namespace Application.Features.Marketing.Commands;

public record CreateCampaignCommand(
    Guid ProjectId,
    string Name,
    string? Channel,
    DateTime? StartDate,
    DateTime? EndDate,
    string? GoalMd,
    decimal? BudgetAmount,
    string? BudgetCurrency,
    Guid? OwnerId) : IRequest<Result<CampaignDto>>;

public class CreateCampaignCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateCampaignCommand, Result<CampaignDto>>
{
    public async Task<Result<CampaignDto>> Handle(CreateCampaignCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 200)
            return Result.Failure<CampaignDto>(MarketingErrors.InvalidCampaignName);

        var channel = MarketingChannel.Other;
        if (!string.IsNullOrWhiteSpace(request.Channel)
            && !Enum.TryParse(request.Channel, ignoreCase: true, out channel))
            return Result.Failure<CampaignDto>(MarketingErrors.InvalidChannel);

        if (request.StartDate is { } s && request.EndDate is { } e && e < s)
            return Result.Failure<CampaignDto>(MarketingErrors.InvalidDateRange);

        if (request.BudgetAmount is { } amt && amt < 0)
            return Result.Failure<CampaignDto>(MarketingErrors.InvalidBudget);

        string? currency = null;
        if (!string.IsNullOrWhiteSpace(request.BudgetCurrency))
        {
            var c = request.BudgetCurrency!.Trim().ToUpperInvariant();
            if (c.Length != 3) return Result.Failure<CampaignDto>(MarketingErrors.InvalidCurrency);
            currency = c;
        }

        var campaign = new Campaign
        {
            ProjectId = request.ProjectId,
            Name = name,
            Channel = channel,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Status = CampaignStatus.Planning,
            GoalMd = request.GoalMd,
            BudgetAmount = request.BudgetAmount,
            BudgetCurrency = currency,
            OwnerId = request.OwnerId,
        };
        db.Campaigns.Add(campaign);
        await db.SaveChangesAsync(ct);

        return Result.Success(new CampaignDto(
            campaign.Id, campaign.ProjectId, campaign.Name, campaign.Channel.ToString(),
            campaign.StartDate, campaign.EndDate, campaign.Status.ToString(),
            campaign.GoalMd, campaign.BudgetAmount, campaign.BudgetCurrency,
            campaign.OwnerId, campaign.CreatedAt, campaign.ArchivedAt,
            AssetCount: 0, PublishedAssetCount: 0, TaskCount: 0, DoneTaskCount: 0));
    }
}
