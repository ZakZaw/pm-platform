using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

/// <summary>
/// Returns the full pipeline for a Sales project — every stage in order,
/// each with its open deals and an aggregate value. The Pipeline view
/// renders columns from this directly.
/// </summary>
public record GetPipelineQuery(Guid ProjectId) : IRequest<Result<PipelineDto>>;

public class GetPipelineQueryHandler(IAppDbContext db)
    : IRequestHandler<GetPipelineQuery, Result<PipelineDto>>
{
    public async Task<Result<PipelineDto>> Handle(GetPipelineQuery request, CancellationToken ct)
    {
        var stages = await db.DealStages
            .Where(s => s.ProjectId == request.ProjectId)
            .OrderBy(s => s.Order)
            .ToListAsync(ct);

        var deals = await db.Deals
            .Where(d => d.ProjectId == request.ProjectId && d.Status == DealStatus.Open)
            .Join(db.Accounts, d => d.AccountId, a => a.Id,
                (d, a) => new { Deal = d, AccountName = a.Name })
            .Join(db.DealStages, x => x.Deal.StageId, s => s.Id,
                (x, s) => new { x.Deal, x.AccountName, StageName = s.Name })
            .ToListAsync(ct);

        var dealsByStage = deals
            .GroupBy(x => x.Deal.StageId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Deal.Value).ToList());

        var stageDtos = stages.Select(s =>
        {
            var stageDeals = dealsByStage.GetValueOrDefault(s.Id) ?? [];
            var dealDtos = stageDeals.Select(x => new DealDto(
                x.Deal.Id, x.Deal.ProjectId, x.Deal.AccountId, x.AccountName,
                x.Deal.Name, x.Deal.Value, x.Deal.Currency,
                x.Deal.StageId, x.StageName, x.Deal.Probability,
                x.Deal.ExpectedClose, x.Deal.OwnerId,
                x.Deal.Status.ToString(),
                x.Deal.LostReason, x.Deal.WonNote,
                x.Deal.CreatedAt, x.Deal.ClosedAt)).ToList();
            return new PipelineStageDto(
                s.Id, s.Name, s.Order, s.DefaultProbability,
                s.IsTerminalWon, s.IsTerminalLost,
                dealDtos.Count,
                dealDtos.Sum(d => d.Value),
                dealDtos);
        }).ToList();

        return Result.Success(new PipelineDto(stageDtos));
    }
}
