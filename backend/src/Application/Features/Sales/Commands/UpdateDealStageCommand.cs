using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record UpdateDealStageCommand(
    Guid StageId,
    string? Name,
    int? DefaultProbability,
    bool? IsTerminalWon,
    bool? IsTerminalLost) : IRequest<Result<DealStageDto>>;

public class UpdateDealStageCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateDealStageCommand, Result<DealStageDto>>
{
    public async Task<Result<DealStageDto>> Handle(
        UpdateDealStageCommand request, CancellationToken ct)
    {
        var stage = await db.DealStages.FirstOrDefaultAsync(s => s.Id == request.StageId, ct);
        if (stage is null)
            return Result.Failure<DealStageDto>(SalesErrors.StageNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 60)
                return Result.Failure<DealStageDto>(SalesErrors.InvalidStageName);
            stage.Name = n;
        }
        if (request.DefaultProbability is { } p)
        {
            if (p is < 0 or > 100)
                return Result.Failure<DealStageDto>(SalesErrors.InvalidProbability);
            stage.DefaultProbability = p;
        }
        if (request.IsTerminalWon.HasValue) stage.IsTerminalWon = request.IsTerminalWon.Value;
        if (request.IsTerminalLost.HasValue) stage.IsTerminalLost = request.IsTerminalLost.Value;

        await db.SaveChangesAsync(ct);

        return Result.Success(new DealStageDto(
            stage.Id, stage.ProjectId, stage.Name, stage.Order, stage.DefaultProbability,
            stage.IsTerminalWon, stage.IsTerminalLost));
    }
}
