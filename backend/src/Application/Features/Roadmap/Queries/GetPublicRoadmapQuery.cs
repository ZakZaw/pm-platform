using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Queries;

/// <summary>
/// Public, no-auth roadmap lookup driven by a share-link token. The handler
/// resolves the link, validates the optional password gate, then projects
/// roadmap data with the link's privacy toggles applied (hide internal
/// labels — descriptions, risk flags; hide assignees — owner names).
/// </summary>
public record GetPublicRoadmapQuery(string Token, string? Password)
    : IRequest<Result<PublicRoadmapDto>>;

public record PublicRoadmapDto(
    string ProjectName,
    string? ProjectKey,
    string ProjectType,
    DateOnly From,
    DateOnly To,
    bool HideInternalLabels,
    bool HideAssignees,
    IReadOnlyList<PublicRoadmapEpicDto> Epics,
    IReadOnlyList<PublicRoadmapMilestoneDto> Milestones);

public record PublicRoadmapEpicDto(
    Guid Id,
    string Title,
    string? Color,
    string Status,
    string? OwnerName,
    DateOnly? StartDate,
    DateOnly? EndDate,
    int? Order,
    bool RiskFlag,
    IReadOnlyList<Guid> DependsOn);

public record PublicRoadmapMilestoneDto(
    Guid Id,
    string Title,
    DateOnly Date,
    string? Color,
    Guid? EpicId);

public class GetPublicRoadmapQueryHandler(IAppDbContext db, IPasswordHasher passwords)
    : IRequestHandler<GetPublicRoadmapQuery, Result<PublicRoadmapDto>>
{
    public async Task<Result<PublicRoadmapDto>> Handle(GetPublicRoadmapQuery request, CancellationToken ct)
    {
        var link = await db.RoadmapShareLinks
            .Where(l => l.Token == request.Token)
            .Select(l => new
            {
                l.Id, l.ProjectId, l.PasswordHash, l.ExpiresAt, l.RevokedAt,
                l.HideInternalLabels, l.HideAssignees,
            })
            .FirstOrDefaultAsync(ct);

        if (link is null) return Result.Failure<PublicRoadmapDto>(RoadmapShareErrors.NotFound);
        if (link.RevokedAt is not null) return Result.Failure<PublicRoadmapDto>(RoadmapShareErrors.Revoked);
        if (link.ExpiresAt is { } exp && exp <= DateTime.UtcNow)
            return Result.Failure<PublicRoadmapDto>(RoadmapShareErrors.Expired);

        if (link.PasswordHash is { } hash)
        {
            if (string.IsNullOrEmpty(request.Password))
                return Result.Failure<PublicRoadmapDto>(RoadmapShareErrors.PasswordRequired);
            if (!passwords.Verify(hash, request.Password))
                return Result.Failure<PublicRoadmapDto>(RoadmapShareErrors.InvalidPassword);
        }

        var project = await db.Projects
            .Where(p => p.Id == link.ProjectId)
            .Select(p => new { p.Name, p.Key, Type = p.Type.ToString() })
            .FirstOrDefaultAsync(ct);
        if (project is null) return Result.Failure<PublicRoadmapDto>(ProjectErrors.NotFound);

        var epicRows = await db.Epics
            .Where(e => e.ProjectId == link.ProjectId && e.ArchivedAt == null)
            .OrderBy(e => e.Order ?? int.MaxValue)
                .ThenBy(e => e.StartDate ?? DateOnly.MaxValue)
                .ThenBy(e => e.CreatedAt)
            .Select(e => new
            {
                e.Id, e.Title, e.Color,
                Status = e.Status.ToString(),
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

        var epics = epicRows.Select(e => new PublicRoadmapEpicDto(
            e.Id, e.Title, e.Color, e.Status,
            link.HideAssignees ? null : e.OwnerName,
            e.StartDate, e.EndDate, e.Order,
            !link.HideInternalLabels && e.RiskFlag,
            depsByEpic.TryGetValue(e.Id, out var ds) ? ds : []))
            .ToList();

        var milestones = await db.Milestones
            .Where(m => m.ProjectId == link.ProjectId)
            .OrderBy(m => m.Date)
            .Select(m => new PublicRoadmapMilestoneDto(m.Id, m.Title, m.Date, m.Color, m.EpicId))
            .ToListAsync(ct);

        var (from, to) = ComputeRange(epics, milestones);

        return Result.Success(new PublicRoadmapDto(
            project.Name, project.Key, project.Type, from, to,
            link.HideInternalLabels, link.HideAssignees, epics, milestones));
    }

    private static (DateOnly From, DateOnly To) ComputeRange(
        IReadOnlyList<PublicRoadmapEpicDto> epics,
        IReadOnlyList<PublicRoadmapMilestoneDto> milestones)
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
