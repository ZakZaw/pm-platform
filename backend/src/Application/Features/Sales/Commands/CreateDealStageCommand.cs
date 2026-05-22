using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Commands;

public record CreateDealStageCommand(
    Guid ProjectId,
    string Name,
    int? DefaultProbability,
    bool IsTerminalWon,
    bool IsTerminalLost) : IRequest<Result<DealStageDto>>;

public class CreateDealStageCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateDealStageCommand, Result<DealStageDto>>
{
    public async Task<Result<DealStageDto>> Handle(
        CreateDealStageCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 60)
            return Result.Failure<DealStageDto>(SalesErrors.InvalidStageName);

        var probability = request.DefaultProbability ?? 0;
        if (probability is < 0 or > 100)
            return Result.Failure<DealStageDto>(SalesErrors.InvalidProbability);

        var nextOrder = 1 + await db.DealStages
            .Where(s => s.ProjectId == request.ProjectId)
            .Select(s => (int?)s.Order)
            .MaxAsync(ct) ?? 0;

        var stage = new DealStage
        {
            ProjectId = request.ProjectId,
            Name = name,
            Order = nextOrder,
            DefaultProbability = probability,
            IsTerminalWon = request.IsTerminalWon,
            IsTerminalLost = request.IsTerminalLost,
        };
        db.DealStages.Add(stage);
        await db.SaveChangesAsync(ct);

        return Result.Success(new DealStageDto(
            stage.Id, stage.ProjectId, stage.Name, stage.Order, stage.DefaultProbability,
            stage.IsTerminalWon, stage.IsTerminalLost));
    }
}
