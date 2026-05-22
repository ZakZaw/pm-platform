using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record CreateMarketingTaskCommand(
    Guid CampaignId,
    Guid? AssetId,
    string Title,
    Guid? AssigneeId,
    DateTime? DueDate) : IRequest<Result<MarketingTaskDto>>;

public class CreateMarketingTaskCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateMarketingTaskCommand, Result<MarketingTaskDto>>
{
    public async Task<Result<MarketingTaskDto>> Handle(CreateMarketingTaskCommand request, CancellationToken ct)
    {
        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length is < 1 or > 200)
            return Result.Failure<MarketingTaskDto>(MarketingErrors.InvalidTaskTitle);

        var campaign = await db.Campaigns
            .Where(c => c.Id == request.CampaignId)
            .Select(c => new { c.Id, c.Name })
            .FirstOrDefaultAsync(ct);
        if (campaign is null) return Result.Failure<MarketingTaskDto>(MarketingErrors.CampaignNotFound);

        string? assetTitle = null;
        if (request.AssetId is { } aid)
        {
            var asset = await db.Assets
                .Where(a => a.Id == aid)
                .Select(a => new { a.CampaignId, a.Title })
                .FirstOrDefaultAsync(ct);
            if (asset is null) return Result.Failure<MarketingTaskDto>(MarketingErrors.AssetNotFound);
            if (asset.CampaignId != campaign.Id)
                return Result.Failure<MarketingTaskDto>(MarketingErrors.AssetNotInCampaign);
            assetTitle = asset.Title;
        }

        var task = new MarketingTask
        {
            CampaignId = campaign.Id,
            AssetId = request.AssetId,
            Title = title,
            AssigneeId = request.AssigneeId,
            DueDate = request.DueDate,
        };
        db.MarketingTasks.Add(task);
        await db.SaveChangesAsync(ct);

        return Result.Success(new MarketingTaskDto(
            task.Id, task.CampaignId, campaign.Name, task.AssetId, assetTitle,
            task.Title, task.Status.ToString(), task.AssigneeId, task.DueDate, task.CreatedAt));
    }
}
