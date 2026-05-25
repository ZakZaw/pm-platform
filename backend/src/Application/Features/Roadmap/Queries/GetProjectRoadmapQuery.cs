using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Queries;

public record GetProjectRoadmapQuery(Guid ProjectId) : IRequest<Result<ProjectRoadmapDto>>;

public record ProjectRoadmapDto(
    Guid ProjectId,
    DateOnly From,
    DateOnly To,
    IReadOnlyList<RoadmapEpicDto> Epics,
    IReadOnlyList<RoadmapMilestoneDto> Milestones);

public record RoadmapEpicDto(
    Guid Id,
    string Title,
    string? Color,
    string Status,
    Guid? OwnerId,
    string? OwnerName,
    DateOnly? StartDate,
    DateOnly? EndDate,
    int? Order,
    bool RiskFlag,
    IReadOnlyList<Guid> DependsOn);

public record RoadmapMilestoneDto(
    Guid Id,
    string Title,
    DateOnly Date,
    string? Color,
    Guid? EpicId);

public class GetProjectRoadmapQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectRoadmapQuery, Result<ProjectRoadmapDto>>
{
    public async Task<Result<ProjectRoadmapDto>> Handle(GetProjectRoadmapQuery request, CancellationToken ct)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!exists) return Result.Failure<ProjectRoadmapDto>(ProjectErrors.NotFound);

        var epicRows = await db.Epics
            .Where(e => e.ProjectId == request.ProjectId && e.ArchivedAt == null)
            .OrderBy(e => e.Order ?? int.MaxValue)
                .ThenBy(e => e.StartDate ?? DateOnly.MaxValue)
                .ThenBy(e => e.CreatedAt)
            .Select(e => new
            {
                e.Id, e.Title, e.Color,
                Status = e.Status.ToString(),
                e.OwnerId,
                OwnerName = e.Owner != null ? e.Owner.FullName : null,
                e.StartDate, e.EndDate, e.Order, e.RiskFlag,
            })
            .ToListAsync(ct);

        var epicIds = epicRows.Select(e => e.Id).ToList();

        var depRows = await db.EpicDependencies
            .Where(d => epicIds.Contains(d.EpicId))
            .Select(d => new { d.EpicId, d.DependsOnEpicId })
            .ToListAsync(ct);

        var depsByEpic = depRows
            .GroupBy(d => d.EpicId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(x => x.DependsOnEpicId).ToList());

        var epics = epicRows.Select(e => new RoadmapEpicDto(
            e.Id, e.Title, e.Color, e.Status, e.OwnerId, e.OwnerName,
            e.StartDate, e.EndDate, e.Order, e.RiskFlag,
            depsByEpic.TryGetValue(e.Id, out var ds) ? ds : []))
            .ToList();

        var milestones = await db.Milestones
            .Where(m => m.ProjectId == request.ProjectId)
            .OrderBy(m => m.Date)
            .Select(m => new RoadmapMilestoneDto(m.Id, m.Title, m.Date, m.Color, m.EpicId))
            .ToListAsync(ct);

        var (from, to) = ComputeRange(epics, milestones);

        return Result.Success(new ProjectRoadmapDto(
            request.ProjectId, from, to, epics, milestones));
    }

    // Pad the natural data window with 2 weeks on each side so bars don't
    // sit flush against the axis. Falls back to "now ± 6 weeks" when the
    // project has no dated work yet.
    private static (DateOnly From, DateOnly To) ComputeRange(
        IReadOnlyList<RoadmapEpicDto> epics,
        IReadOnlyList<RoadmapMilestoneDto> milestones)
    {
        DateOnly? min = null, max = null;
        foreach (var e in epics)
        {
            if (e.StartDate is { } s) min = min is null || s < min ? s : min;
            if (e.EndDate is { } x) max = max is null || x > max ? x : max;
        }
        foreach (var m in milestones)
        {
            min = min is null || m.Date < min ? m.Date : min;
            max = max is null || m.Date > max ? m.Date : max;
        }

        if (min is null || max is null)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            return (today.AddDays(-42), today.AddDays(42));
        }
        return (min.Value.AddDays(-14), max.Value.AddDays(14));
    }
}
