using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

/// <summary>
/// Updates an asset's publish date — the write triggered by dragging an
/// asset chip to a different slot on the content calendar (AC for
/// F1.5-04).
/// </summary>
public record RescheduleAssetCommand(
    Guid AssetId,
    DateTime? PublishDate) : IRequest<Result<AssetDto>>;

public class RescheduleAssetCommandHandler(IAppDbContext db)
    : IRequestHandler<RescheduleAssetCommand, Result<AssetDto>>
{
    public async Task<Result<AssetDto>> Handle(RescheduleAssetCommand request, CancellationToken ct)
    {
        var asset = await db.Assets.FirstOrDefaultAsync(a => a.Id == request.AssetId, ct);
        if (asset is null) return Result.Failure<AssetDto>(MarketingErrors.AssetNotFound);

        asset.PublishDate = request.PublishDate;
        asset.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var campaign = await db.Campaigns
            .Where(c => c.Id == asset.CampaignId)
            .Select(c => new { c.Name, c.Channel })
            .FirstAsync(ct);

        return Result.Success(new AssetDto(
            asset.Id, asset.CampaignId, campaign.Name, campaign.Channel.ToString(),
            asset.Type.ToString(), asset.Title, asset.Status.ToString(),
            asset.PublishDate, asset.OwnerId, asset.FileUrl, asset.BodyMd,
            asset.RejectionReason, asset.CreatedAt, asset.UpdatedAt));
    }
}
