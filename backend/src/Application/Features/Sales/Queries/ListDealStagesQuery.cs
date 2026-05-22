using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record ListDealStagesQuery(Guid ProjectId) : IRequest<Result<IReadOnlyList<DealStageDto>>>;

public class ListDealStagesQueryHandler(IAppDbContext db)
    : IRequestHandler<ListDealStagesQuery, Result<IReadOnlyList<DealStageDto>>>
{
    public async Task<Result<IReadOnlyList<DealStageDto>>> Handle(
        ListDealStagesQuery request, CancellationToken ct)
    {
        var rows = await db.DealStages
            .Where(s => s.ProjectId == request.ProjectId)
            .OrderBy(s => s.Order)
            .Select(s => new DealStageDto(
                s.Id, s.ProjectId, s.Name, s.Order, s.DefaultProbability,
                s.IsTerminalWon, s.IsTerminalLost))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<DealStageDto>>(rows);
    }
}
