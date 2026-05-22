using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record ReorderDealStagesCommand(Guid ProjectId, IReadOnlyList<Guid> OrderedIds)
    : IRequest<Result>;

public class ReorderDealStagesCommandHandler(IAppDbContext db)
    : IRequestHandler<ReorderDealStagesCommand, Result>
{
    public async Task<Result> Handle(ReorderDealStagesCommand request, CancellationToken ct)
    {
        if (request.OrderedIds is null || request.OrderedIds.Count == 0)
            return Result.Failure(SalesErrors.StageNotFound);

        var stages = await db.DealStages
            .Where(s => s.ProjectId == request.ProjectId)
            .ToListAsync(ct);

        var byId = stages.ToDictionary(s => s.Id);
        for (var i = 0; i < request.OrderedIds.Count; i++)
        {
            if (byId.TryGetValue(request.OrderedIds[i], out var stage))
                stage.Order = i;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
