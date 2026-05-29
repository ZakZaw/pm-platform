using System.Text.Json;
using Application.Common;
using Application.Features.Sprints;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using SprintStatus = Domain.Enums.SprintStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// AN-02 — velocity of the last six started sprints (Active + Closed), oldest
/// first, with a trailing rolling-average overlay. Committed reflects the
/// scope baseline at start; completed is the recorded final velocity for a
/// closed sprint, or the live Done points for the active one. Planning
/// sprints are excluded — they have no committed scope yet.
/// </summary>
public record GetVelocityQuery(Guid ProjectId) : IRequest<Result<VelocityDto>>;

public class GetVelocityQueryHandler(IAppDbContext db)
    : IRequestHandler<GetVelocityQuery, Result<VelocityDto>>
{
    private const int WindowSize = 6;
    private const int RollingWindow = 3;

    public async Task<Result<VelocityDto>> Handle(GetVelocityQuery request, CancellationToken ct)
    {
        var sprints = await db.Sprints
            .Where(s => s.ProjectId == request.ProjectId && s.Status != SprintStatus.Planning)
            .OrderByDescending(s => s.StartDate)
            .Take(WindowSize)
            .Select(s => new
            {
                s.Id,
                s.Name,
                s.Status,
                s.StartDate,
                s.FinalVelocity,
                s.ScopeBaselineJson,
                LiveTotal = db.Tasks.Where(t => t.SprintId == s.Id).Sum(t => (int?)t.StoryPoints) ?? 0,
                LiveDone = db.Tasks
                    .Where(t => t.SprintId == s.Id && t.Status == DomainTaskStatus.Done)
                    .Sum(t => (int?)t.StoryPoints) ?? 0,
            })
            .ToListAsync(ct);

        // Oldest first for the left-to-right chart axis.
        sprints.Reverse();

        var completedSeries = sprints
            .Select(s => s.Status == SprintStatus.Closed
                ? s.FinalVelocity ?? s.LiveDone
                : s.LiveDone)
            .ToList();

        var result = new List<VelocitySprintDto>(sprints.Count);
        for (var i = 0; i < sprints.Count; i++)
        {
            var s = sprints[i];
            var committed = CommittedPoints(s.ScopeBaselineJson, s.LiveTotal);
            var completed = completedSeries[i];

            // Trailing average of completed velocity over the last
            // RollingWindow sprints up to and including this one.
            var from = Math.Max(0, i - RollingWindow + 1);
            var window = completedSeries.GetRange(from, i - from + 1);
            var rolling = Math.Round(window.Average(), 1);

            result.Add(new VelocitySprintDto(
                s.Id, s.Name, committed, completed, rolling,
                Current: s.Status == SprintStatus.Active));
        }

        return Result.Success(new VelocityDto(result));
    }

    private static int CommittedPoints(string? baselineJson, int liveTotal)
    {
        if (string.IsNullOrWhiteSpace(baselineJson))
            return liveTotal;
        var baseline = JsonSerializer.Deserialize<List<ScopeBaselineTask>>(baselineJson) ?? [];
        return baseline.Sum(t => t.StoryPoints ?? 0);
    }
}
