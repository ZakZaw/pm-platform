using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Workflow.Commands;

/// <summary>
/// Reorders the project's status columns. Caller sends the full ordered list
/// of config IDs; rows not in the list keep their existing OrderIndex. All
/// IDs must belong to the project (otherwise the call is rejected entirely).
/// </summary>
public record ReorderStatusConfigCommand(Guid ProjectId, IReadOnlyList<Guid> OrderedConfigIds)
    : IRequest<Result<IReadOnlyList<StatusConfigDto>>>;

public class ReorderStatusConfigCommandHandler(IAppDbContext db)
    : IRequestHandler<ReorderStatusConfigCommand, Result<IReadOnlyList<StatusConfigDto>>>
{
    public async Task<Result<IReadOnlyList<StatusConfigDto>>> Handle(
        ReorderStatusConfigCommand request, CancellationToken ct)
    {
        if (request.OrderedConfigIds is null || request.OrderedConfigIds.Count == 0)
            return Result.Failure<IReadOnlyList<StatusConfigDto>>(WorkflowErrors.InvalidReorder);

        var rows = await db.ProjectStatusConfigs
            .Where(c => c.ProjectId == request.ProjectId)
            .ToListAsync(ct);

        var byId = rows.ToDictionary(r => r.Id);
        for (var i = 0; i < request.OrderedConfigIds.Count; i++)
        {
            if (!byId.TryGetValue(request.OrderedConfigIds[i], out var row))
                return Result.Failure<IReadOnlyList<StatusConfigDto>>(WorkflowErrors.ConfigNotFound);
            row.OrderIndex = i;
        }

        await db.SaveChangesAsync(ct);

        var ordered = rows.OrderBy(r => r.OrderIndex)
            .Select(r => new StatusConfigDto(
                r.Id, r.ProjectId, r.Status.ToString(), r.DisplayName,
                r.Color, r.OrderIndex, r.IsDoneState, r.IsVisible, r.WipLimit))
            .ToList();
        return Result.Success<IReadOnlyList<StatusConfigDto>>(ordered);
    }
}
