using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record DeleteAssetCommand(Guid AssetId) : IRequest<Result>;

public class DeleteAssetCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteAssetCommand, Result>
{
    public async Task<Result> Handle(DeleteAssetCommand request, CancellationToken ct)
    {
        var asset = await db.Assets.FirstOrDefaultAsync(a => a.Id == request.AssetId, ct);
        if (asset is null) return Result.Failure(MarketingErrors.AssetNotFound);

        db.Assets.Remove(asset);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
