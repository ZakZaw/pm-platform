using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record CreateAssetCommand(
    Guid CampaignId,
    string? Type,
    string Title,
    DateTime? PublishDate,
    Guid? OwnerId,
    string? FileUrl,
    string? BodyMd) : IRequest<Result<AssetDto>>;

public class CreateAssetCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateAssetCommand, Result<AssetDto>>
{
    public async Task<Result<AssetDto>> Handle(CreateAssetCommand request, CancellationToken ct)
    {
        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length is < 1 or > 200)
            return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetTitle);

        var campaign = await db.Campaigns
            .Where(c => c.Id == request.CampaignId)
            .Select(c => new { c.Id, c.Name, c.Channel })
            .FirstOrDefaultAsync(ct);
        if (campaign is null) return Result.Failure<AssetDto>(MarketingErrors.CampaignNotFound);

        var type = AssetType.Other;
        if (!string.IsNullOrWhiteSpace(request.Type)
            && !Enum.TryParse(request.Type, ignoreCase: true, out type))
            return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetType);

        var asset = new Asset
        {
            CampaignId = campaign.Id,
            Type = type,
            Title = title,
            Status = AssetStatus.Draft,
            PublishDate = request.PublishDate,
            OwnerId = request.OwnerId,
            FileUrl = request.FileUrl?.Trim(),
            BodyMd = request.BodyMd,
        };
        db.Assets.Add(asset);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AssetDto(
            asset.Id, asset.CampaignId, campaign.Name, campaign.Channel.ToString(),
            asset.Type.ToString(), asset.Title, asset.Status.ToString(),
            asset.PublishDate, asset.OwnerId, asset.FileUrl, asset.BodyMd,
            asset.RejectionReason, asset.CreatedAt, asset.UpdatedAt));
    }
}
