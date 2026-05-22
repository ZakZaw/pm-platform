using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

/// <summary>
/// Walks an asset through the publishing lifecycle:
/// Draft → Review → Approved → Published → Archived.
/// Backwards transitions: Review → Draft (rejection — requires reason),
/// Approved → Review (send back for edits), Published → Archived (retire).
/// Rejecting from Review back to Draft persists the reason on the asset
/// so reviewers can see why it bounced (AC for F1.5-04).
/// </summary>
public record ChangeAssetStatusCommand(
    Guid AssetId,
    string To,
    string? Reason) : IRequest<Result<AssetDto>>;

public class ChangeAssetStatusCommandHandler(IAppDbContext db)
    : IRequestHandler<ChangeAssetStatusCommand, Result<AssetDto>>
{
    public async Task<Result<AssetDto>> Handle(ChangeAssetStatusCommand request, CancellationToken ct)
    {
        if (!Enum.TryParse<AssetStatus>(request.To, ignoreCase: true, out var to))
            return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetStatus);

        var asset = await db.Assets.FirstOrDefaultAsync(a => a.Id == request.AssetId, ct);
        if (asset is null) return Result.Failure<AssetDto>(MarketingErrors.AssetNotFound);

        if (asset.Status == to)
            return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetTransition);

        if (!IsAllowed(asset.Status, to))
            return Result.Failure<AssetDto>(MarketingErrors.InvalidAssetTransition);

        if (asset.Status == AssetStatus.Review && to == AssetStatus.Draft
            && string.IsNullOrWhiteSpace(request.Reason))
            return Result.Failure<AssetDto>(MarketingErrors.RejectionReasonRequired);

        asset.Status = to;
        asset.UpdatedAt = DateTime.UtcNow;
        if (to == AssetStatus.Draft && !string.IsNullOrWhiteSpace(request.Reason))
            asset.RejectionReason = request.Reason.Trim();
        else if (to != AssetStatus.Draft)
            asset.RejectionReason = null;

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

    private static bool IsAllowed(AssetStatus from, AssetStatus to) => (from, to) switch
    {
        (AssetStatus.Draft,     AssetStatus.Review)    => true,
        (AssetStatus.Review,    AssetStatus.Approved)  => true,
        (AssetStatus.Review,    AssetStatus.Draft)     => true,
        (AssetStatus.Approved,  AssetStatus.Published) => true,
        (AssetStatus.Approved,  AssetStatus.Review)    => true,
        (AssetStatus.Published, AssetStatus.Archived)  => true,
        (AssetStatus.Archived,  AssetStatus.Draft)     => true,
        _ => false,
    };
}
