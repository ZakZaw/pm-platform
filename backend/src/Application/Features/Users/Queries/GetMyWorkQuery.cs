using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Users.Queries;

/// <summary>
/// Cross-project task list for the current user. Optional filters:
/// time bucket (overdue/today/week), project, sprint.
/// </summary>
public record GetMyWorkQuery(
    string? Filter,
    Guid? ProjectId,
    Guid? SprintId) : IRequest<Result<IReadOnlyList<MyWorkItemDto>>>;

public class GetMyWorkQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyWorkQuery, Result<IReadOnlyList<MyWorkItemDto>>>
{
    public async Task<Result<IReadOnlyList<MyWorkItemDto>>> Handle(
        GetMyWorkQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MyWorkItemDto>>(AuthErrors.NotAuthenticated);

        var query = from t in db.Tasks
                    join p in db.Projects on t.ProjectId equals p.Id
                    where t.AssigneeId == userId
                          && t.Status != DomainTaskStatus.Done
                          && t.Status != DomainTaskStatus.WontDo
                    select new
                    {
                        t.Id, t.KeyNum, t.Title, t.Description,
                        Status = t.Status.ToString(),
                        Priority = t.Priority.ToString(),
                        t.StoryPoints,
                        t.DueDate,
                        ProjectId = p.Id,
                        ProjectSlug = p.Slug,
                        ProjectName = p.Name,
                        ProjectKey = p.Key,
                        ProjectIsPersonal = p.IsPersonal,
                        OrgSlug = p.Organization != null ? p.Organization.Slug : null,
                        t.SprintId,
                        t.CreatedAt
                    };

        if (request.ProjectId.HasValue)
            query = query.Where(x => x.ProjectId == request.ProjectId);
        if (request.SprintId.HasValue)
            query = query.Where(x => x.SprintId == request.SprintId);

        var raw = await query.ToListAsync(ct);
        var items = raw.Select(x => new MyWorkItemDto(
            x.Id, $"{x.ProjectKey}-{x.KeyNum}", x.KeyNum,
            x.Title, x.Description, x.Status, x.Priority, x.StoryPoints, x.DueDate,
            x.ProjectId, x.ProjectSlug, x.ProjectName, x.ProjectKey, x.ProjectIsPersonal,
            x.OrgSlug, x.SprintId, x.CreatedAt)).ToList();

        if (!string.IsNullOrWhiteSpace(request.Filter))
        {
            var tz = await db.Users.Where(u => u.Id == userId)
                .Select(u => u.Timezone).FirstOrDefaultAsync(ct) ?? "UTC";
            var (overdueCutoff, todayEnd, weekEnd) = ComputeBoundaries(tz);
            items = request.Filter.ToLowerInvariant() switch
            {
                "overdue" => items.Where(i => i.DueDate is { } d && d < overdueCutoff).ToList(),
                "today" => items.Where(i => i.DueDate is { } d && d >= overdueCutoff && d < todayEnd).ToList(),
                "week" => items.Where(i => i.DueDate is { } d && d >= todayEnd && d < weekEnd).ToList(),
                _ => items,
            };
        }

        items = items
            .OrderBy(i => i.DueDate is null)
            .ThenBy(i => i.DueDate)
            .ThenBy(i => i.CreatedAt)
            .ToList();

        return Result.Success<IReadOnlyList<MyWorkItemDto>>(items);
    }

    private static (DateTime overdueCutoff, DateTime todayEnd, DateTime weekEnd) ComputeBoundaries(string ianaTz)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(ianaTz); }
        catch { tz = TimeZoneInfo.Utc; }
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var startOfToday = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var startOfTomorrow = startOfToday.AddDays(1);
        var sevenDaysOut = startOfToday.AddDays(8);
        return (
            TimeZoneInfo.ConvertTimeToUtc(startOfToday, tz),
            TimeZoneInfo.ConvertTimeToUtc(startOfTomorrow, tz),
            TimeZoneInfo.ConvertTimeToUtc(sevenDaysOut, tz));
    }
}
