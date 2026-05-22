using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Marketing.Commands;

public record DeleteCampaignCommand(Guid CampaignId) : IRequest<Result>;

public class DeleteCampaignCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteCampaignCommand, Result>
{
    public async Task<Result> Handle(DeleteCampaignCommand request, CancellationToken ct)
    {
        var campaign = await db.Campaigns.FirstOrDefaultAsync(c => c.Id == request.CampaignId, ct);
        if (campaign is null) return Result.Failure(MarketingErrors.CampaignNotFound);

        db.Campaigns.Remove(campaign);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
