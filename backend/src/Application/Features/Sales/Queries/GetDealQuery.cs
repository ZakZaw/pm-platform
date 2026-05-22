using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record GetDealQuery(Guid DealId) : IRequest<Result<DealDto>>;

public class GetDealQueryHandler(IAppDbContext db)
    : IRequestHandler<GetDealQuery, Result<DealDto>>
{
    public async Task<Result<DealDto>> Handle(GetDealQuery request, CancellationToken ct)
    {
        var row = await db.Deals
            .Where(d => d.Id == request.DealId)
            .Join(db.Accounts, d => d.AccountId, a => a.Id,
                (d, a) => new { d, AccountName = a.Name })
            .Join(db.DealStages, x => x.d.StageId, s => s.Id,
                (x, s) => new { x.d, x.AccountName, StageName = s.Name })
            .FirstOrDefaultAsync(ct);
        if (row is null) return Result.Failure<DealDto>(SalesErrors.DealNotFound);

        return Result.Success(new DealDto(
            row.d.Id, row.d.ProjectId, row.d.AccountId, row.AccountName,
            row.d.Name, row.d.Value, row.d.Currency,
            row.d.StageId, row.StageName, row.d.Probability,
            row.d.ExpectedClose, row.d.OwnerId,
            row.d.Status.ToString(), row.d.LostReason, row.d.WonNote,
            row.d.CreatedAt, row.d.ClosedAt));
    }
}
