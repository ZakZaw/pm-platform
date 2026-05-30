using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Team workload heatmap (F3-14): for each project member, how many tasks they
/// moved to Done on each of the last 10 calendar days. Real per-day throughput
/// drawn from the status-change audit, replacing the placeholder grid.
/// </summary>
public record GetWorkloadQuery(Guid ProjectId) : IRequest<Result<WorkloadDto>>;

public class GetWorkloadQueryHandler(IAppDbContext db)
    : IRequestHandler<GetWorkloadQuery, Result<WorkloadDto>>
{
    private const int DayWindow = 10;

    public async Task<Result<WorkloadDto>> Handle(GetWorkloadQuery request, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var firstDay = today.AddDays(-(DayWindow - 1));

        var members = await db.ProjectMemberships
            .Where(m => m.ProjectId == request.ProjectId)
            .OrderBy(m => m.User.FullName)
            .Select(m => new { m.UserId, m.User.FullName })
            .ToListAsync(ct);

        // Done-transitions within the window, attributed to whoever made them,
        // for tasks in this project.
        var completions = await db.TaskStatusChanges
            .Where(c => c.ToStatus == DomainTaskStatus.Done
                && c.CreatedAt >= firstDay
                && c.Task.ProjectId == request.ProjectId)
            .Select(c => new { c.ByUserId, c.CreatedAt })
            .ToListAsync(ct);

        var byUserDay = completions
            .GroupBy(c => (c.ByUserId, Day: c.CreatedAt.Date))
            .ToDictionary(g => g.Key, g => g.Count());

        var days = new List<string>(DayWindow);
        var dayDates = new List<DateTime>(DayWindow);
        for (var i = 0; i < DayWindow; i++)
        {
            var d = firstDay.AddDays(i);
            dayDates.Add(d);
            days.Add(d.ToString("ddd")[..1]);
        }

        var memberDtos = members
            .Select(m => new WorkloadMemberDto(
                m.UserId,
                m.FullName,
                dayDates.Select(d => byUserDay.GetValueOrDefault((m.UserId, d), 0)).ToList()))
            .ToList();

        return Result.Success(new WorkloadDto(days, memberDtos));
    }
}
