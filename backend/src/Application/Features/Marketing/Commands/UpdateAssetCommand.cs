using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record UpdateAssetCommand(
    Guid AssetId,
    string? Type,
    string? Title,
    DateTime? PublishDate,
    bool ClearPublishDate,
    Guid? OwnerId,
    bool ClearOwner,
    string? FileUrl,
    bool ClearFileUrl,
    string? BodyMd) : IRequest<Result<AssetDto>>;

public class UpdateAssetCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateAssetCommand, Result<AssetDto>>
{
    public async Task<Result<AssetDto>> Handle(UpdateAssetCommand request, CancellationToken ct)
    {
        var asset = await db.Assets.FirstOrDefaultAsync(a => a.Id == request.AssetId, ct);
        if (asset is null) return Result.Failure<AssetDto>(MarketingErrors.AssetNotFound);

        if (request.Title is not null)
        {
            var t = request.Title.Trim();
            if (t.Length is < 1 or > 200)
                return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetTitle);
            asset.Title = t;
        }
        if (request.Type is not null)
        {
            if (!Enum.TryParse<AssetType>(request.Type, ignoreCase: true, out var tp))
                return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetType);
            asset.Type = tp;
        }
        if (request.ClearPublishDate) asset.PublishDate = null;
        else if (request.PublishDate.HasValue) asset.PublishDate = request.PublishDate;

        if (request.ClearOwner) asset.OwnerId = null;
        else if (request.OwnerId.HasValue) asset.OwnerId = request.OwnerId;

        if (request.ClearFileUrl) asset.FileUrl = null;
        else if (request.FileUrl is not null) asset.FileUrl = request.FileUrl.Trim();

        if (request.BodyMd is not null) asset.BodyMd = request.BodyMd;

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
