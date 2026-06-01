using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Operations project dashboard analytics — the live next-7-days and overdue
/// run lists, plus the trailing-30-day completion / on-time / skip rates over
/// scheduled runs. Rate math lives in the pure <see cref="RunCompletionCalculator"/>.
/// </summary>
public record GetOperationsAnalyticsQuery(Guid ProjectId) : IRequest<Result<OperationsAnalyticsDto>>;

public class GetOperationsAnalyticsQueryHandler(IAppDbContext db)
    : IRequestHandler<GetOperationsAnalyticsQuery, Result<OperationsAnalyticsDto>>
{
    private const int WindowDays = 30;
    private const int UpcomingWindowDays = 7;
    private const int MaxList = 6;

    public async Task<Result<OperationsAnalyticsDto>> Handle(GetOperationsAnalyticsQuery request, CancellationToken ct)
    {
        var runs = await db.WorkflowRuns
            .Where(r => r.Workflow.ProjectId == request.ProjectId)
            .Select(r => new
            {
                r.Id,
                WorkflowName = r.Workflow.Name,
                r.ScheduledFor,
                r.Status,
                r.CompletedAt,
            })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var today = now.Date;

        static bool IsPending(WorkflowRunStatus s) =>
            s is WorkflowRunStatus.Pending or WorkflowRunStatus.InProgress;

        var upcomingCutoff = now.AddDays(UpcomingWindowDays);
        var upcoming = runs
            .Where(r => IsPending(r.Status) && r.ScheduledFor >= now && r.ScheduledFor <= upcomingCutoff)
            .OrderBy(r => r.ScheduledFor)
            .ToList();
        var overdue = runs
            .Where(r => IsPending(r.Status) && r.ScheduledFor < now)
            .OrderBy(r => r.ScheduledFor)
            .ToList();

        // Completion window — runs scheduled in the trailing N days.
        var windowStart = now.AddDays(-WindowDays);
        var window = runs.Where(r => r.ScheduledFor >= windowStart && r.ScheduledFor <= now).ToList();
        var completed = window.Where(r => r.Status == WorkflowRunStatus.Completed).ToList();
        var onTime = completed.Count(r => r.CompletedAt is { } c && c.Date <= r.ScheduledFor.Date);
        var skipped = window.Count(r => r.Status == WorkflowRunStatus.Skipped);
        var missed = window.Count(r => IsPending(r.Status) && r.ScheduledFor < now);

        var rates = RunCompletionCalculator.Compute(
            new(completed.Count, onTime, skipped, missed));

        return Result.Success(new OperationsAnalyticsDto(
            upcoming.Count,
            overdue.Count,
            rates.CompletionPct,
            rates.OnTimePct,
            rates.SkipPct,
            rates.Total,
            upcoming.Take(MaxList).Select(r => new OpsRunDto(r.Id, r.WorkflowName, r.ScheduledFor)).ToList(),
            overdue.Take(MaxList).Select(r => new OpsRunDto(r.Id, r.WorkflowName, r.ScheduledFor)).ToList()));
    }
}
