using Application.Common;
using Application.Features.Roadmap.Commands;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Queries;

public record ListRoadmapShareLinksQuery(Guid ProjectId)
    : IRequest<Result<IReadOnlyList<RoadmapShareLinkDto>>>;

public class ListRoadmapShareLinksQueryHandler(IAppDbContext db)
    : IRequestHandler<ListRoadmapShareLinksQuery, Result<IReadOnlyList<RoadmapShareLinkDto>>>
{
    public async Task<Result<IReadOnlyList<RoadmapShareLinkDto>>> Handle(
        ListRoadmapShareLinksQuery request, CancellationToken ct)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!exists) return Result.Failure<IReadOnlyList<RoadmapShareLinkDto>>(ProjectErrors.NotFound);

        var rows = await db.RoadmapShareLinks
            .Where(l => l.ProjectId == request.ProjectId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new RoadmapShareLinkDto(
                l.Id, l.ProjectId, l.Token, l.PasswordHash != null,
                l.ExpiresAt, l.HideInternalLabels, l.HideAssignees,
                l.CreatedByUserId, l.CreatedBy.FullName, l.CreatedAt, l.RevokedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<RoadmapShareLinkDto>>(rows);
    }
}
