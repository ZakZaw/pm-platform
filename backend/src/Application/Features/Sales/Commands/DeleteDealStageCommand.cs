using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record DeleteDealStageCommand(Guid StageId) : IRequest<Result>;

public class DeleteDealStageCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteDealStageCommand, Result>
{
    public async Task<Result> Handle(DeleteDealStageCommand request, CancellationToken ct)
    {
        var stage = await db.DealStages.FirstOrDefaultAsync(s => s.Id == request.StageId, ct);
        if (stage is null) return Result.Failure(SalesErrors.StageNotFound);

        var hasDeals = await db.Deals.AnyAsync(d => d.StageId == stage.Id, ct);
        if (hasDeals) return Result.Failure(SalesErrors.CannotDeleteStageWithDeals);

        db.DealStages.Remove(stage);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
