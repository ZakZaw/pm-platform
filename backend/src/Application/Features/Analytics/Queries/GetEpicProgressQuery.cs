using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// AN-03 — per-epic completion, by both story points and task count. Computed
/// fresh on every call, so it always reflects the latest story-points edits.
/// Archived epics are excluded; epics with no tasks are dropped. Ordered by
/// total points descending so the heaviest epics lead.
/// </summary>
public record GetEpicProgressQuery(Guid ProjectId) : IRequest<Result<EpicProgressResultDto>>;

public class GetEpicProgressQueryHandler(IAppDbContext db)
    : IRequestHandler<GetEpicProgressQuery, Result<EpicProgressResultDto>>
{
    public async Task<Result<EpicProgressResultDto>> Handle(GetEpicProgressQuery request, CancellationToken ct)
    {
        var epics = await db.Epics
            .Where(e => e.ProjectId == request.ProjectId && e.ArchivedAt == null)
            .Select(e => new
            {
                e.Id,
                e.Title,
                e.Color,
                TotalCount = e.Tasks.Count,
                DoneCount = e.Tasks.Count(t => t.Status == DomainTaskStatus.Done),
                TotalPoints = e.Tasks.Sum(t => (int?)t.StoryPoints) ?? 0,
                DonePoints = e.Tasks
                    .Where(t => t.Status == DomainTaskStatus.Done)
                    .Sum(t => (int?)t.StoryPoints) ?? 0,
            })
            .Where(e => e.TotalCount > 0)
            .OrderByDescending(e => e.TotalPoints)
            .ThenByDescending(e => e.TotalCount)
            .ToListAsync(ct);

        var dtos = epics
            .Select(e => new EpicProgressDto(
                e.Id, e.Title, e.Color, e.DonePoints, e.TotalPoints, e.DoneCount, e.TotalCount))
            .ToList();

        return Result.Success(new EpicProgressResultDto(dtos));
    }
}
