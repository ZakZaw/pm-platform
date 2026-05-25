using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.ActivityFeed.Queries;

/// <summary>
/// Reverse-chronological project activity feed. <paramref name="Before"/>
/// enables cursor-style pagination — pass the createdAt of the last item
/// from the previous page.
/// </summary>
public record GetProjectActivityQuery(
    Guid ProjectId,
    int Limit = 50,
    DateTime? Before = null)
    : IRequest<Result<ProjectActivityFeedDto>>;

public record ProjectActivityFeedDto(
    Guid ProjectId,
    IReadOnlyList<ActivityEntryDto> Entries,
    DateTime? NextCursor);

public record ActivityEntryDto(
    Guid Id,
    string Verb,
    string TargetType,
    Guid TargetId,
    string? Summary,
    string? Metadata,
    DateTime CreatedAt,
    ActivityActorDto Actor);

public record ActivityActorDto(Guid Id, string FullName, string? AvatarUrl);

public class GetProjectActivityQueryHandler(IAppDbContext db)
    : IRequestHandler<GetProjectActivityQuery, Result<ProjectActivityFeedDto>>
{
    public async Task<Result<ProjectActivityFeedDto>> Handle(
        GetProjectActivityQuery request, CancellationToken ct)
    {
        var limit = Math.Clamp(request.Limit, 1, 200);

        var q = db.ActivityLogs
            .Where(a => a.ProjectId == request.ProjectId)
            .OrderByDescending(a => a.CreatedAt)
            .AsQueryable();

        if (request.Before is { } before)
            q = q.Where(a => a.CreatedAt < before);

        var rows = await q
            .Take(limit + 1)
            .Select(a => new
            {
                a.Id, a.Verb, a.TargetType, a.TargetId,
                a.Summary, a.MetadataJson, a.CreatedAt,
                Actor = new { a.Actor.Id, a.Actor.FullName, a.Actor.AvatarUrl }
            })
            .ToListAsync(ct);

        DateTime? nextCursor = null;
        if (rows.Count > limit)
        {
            nextCursor = rows[^1].CreatedAt;
            rows.RemoveAt(rows.Count - 1);
        }

        var entries = rows.Select(r => new ActivityEntryDto(
            r.Id, r.Verb.ToString(), r.TargetType, r.TargetId,
            r.Summary, r.MetadataJson, r.CreatedAt,
            new ActivityActorDto(r.Actor.Id, r.Actor.FullName, r.Actor.AvatarUrl)))
            .ToList();

        return Result.Success(new ProjectActivityFeedDto(request.ProjectId, entries, nextCursor));
    }
}
