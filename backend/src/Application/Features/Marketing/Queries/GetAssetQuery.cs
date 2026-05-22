using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Queries;

public record GetAssetQuery(Guid AssetId) : IRequest<Result<AssetDto>>;

public class GetAssetQueryHandler(IAppDbContext db)
    : IRequestHandler<GetAssetQuery, Result<AssetDto>>
{
    public async Task<Result<AssetDto>> Handle(GetAssetQuery request, CancellationToken ct)
    {
        var row = await db.Assets
            .Where(a => a.Id == request.AssetId)
            .Select(a => new AssetDto(
                a.Id, a.CampaignId, a.Campaign.Name, a.Campaign.Channel.ToString(),
                a.Type.ToString(), a.Title, a.Status.ToString(),
                a.PublishDate, a.OwnerId, a.FileUrl, a.BodyMd,
                a.RejectionReason, a.CreatedAt, a.UpdatedAt))
            .FirstOrDefaultAsync(ct);
        if (row is null) return Result.Failure<AssetDto>(MarketingErrors.AssetNotFound);
        return Result.Success(row);
    }
}
