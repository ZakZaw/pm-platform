using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Workflow.Queries;

public record ListProjectStatusConfigQuery(Guid ProjectId)
    : IRequest<Result<IReadOnlyList<StatusConfigDto>>>;

public class ListProjectStatusConfigQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectStatusConfigQuery, Result<IReadOnlyList<StatusConfigDto>>>
{
    public async Task<Result<IReadOnlyList<StatusConfigDto>>> Handle(
        ListProjectStatusConfigQuery request, CancellationToken ct)
    {
        var projectExists = await db.Projects
            .AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<IReadOnlyList<StatusConfigDto>>(ProjectErrors.NotFound);

        var rows = await db.ProjectStatusConfigs
            .Where(c => c.ProjectId == request.ProjectId)
            .OrderBy(c => c.OrderIndex)
            .ToListAsync(ct);

        // Lazy-seed defaults the first time a project's workflow is read.
        // Keeps Phase 1 simple (no need to seed on project create) and means
        // existing projects pick up the configs without a data migration.
        if (rows.Count == 0)
        {
            foreach (var seed in StatusConfigDefaults.Seed(request.ProjectId))
                db.ProjectStatusConfigs.Add(seed);
            await db.SaveChangesAsync(ct);
            rows = await db.ProjectStatusConfigs
                .Where(c => c.ProjectId == request.ProjectId)
                .OrderBy(c => c.OrderIndex)
                .ToListAsync(ct);
        }

        var dtos = rows.Select(r => new StatusConfigDto(
            r.Id, r.ProjectId, r.Status.ToString(), r.DisplayName, r.Color,
            r.OrderIndex, r.IsDoneState, r.IsVisible, r.WipLimit)).ToList();

        return Result.Success<IReadOnlyList<StatusConfigDto>>(dtos);
    }
}
