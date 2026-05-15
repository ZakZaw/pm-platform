using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Users.Queries;

/// <summary>
/// Cross-project task list for the current user. Optional filter narrows
/// by due-date bucket (in the user's configured timezone). The full list
/// is also fine — the frontend can bucket client-side.
/// </summary>
public record GetMyWorkQuery(string? Filter) : IRequest<Result<IReadOnlyList<MyWorkItemDto>>>;

public class GetMyWorkQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyWorkQuery, Result<IReadOnlyList<MyWorkItemDto>>>
{
    public async Task<Result<IReadOnlyList<MyWorkItemDto>>> Handle(
        GetMyWorkQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MyWorkItemDto>>(AuthErrors.NotAuthenticated);

        // Open tasks only — Done / WontDo are terminal and clutter My Work.
        var query = from t in db.Tasks
                    join s in db.Stories on t.StoryId equals s.Id
                    join p in db.Projects on s.ProjectId equals p.Id
                    join o in db.Organizations on p.OrganizationId equals o.Id
                    where t.AssigneeId == userId
                          && t.Status != DomainTaskStatus.Done
                          && t.Status != DomainTaskStatus.WontDo
                    select new MyWorkItemDto(
                        t.Id,
                        s.Id,
                        s.Title,
                        t.Title,
                        t.Description,
                        t.Status.ToString(),
                        t.Priority.ToString(),
                        s.DueDate,
                        p.Id,
                        p.Slug,
                        p.Name,
                        o.Slug,
                        t.CreatedAt);

        var items = await query.ToListAsync(ct);

        if (!string.IsNullOrWhiteSpace(request.Filter))
        {
            var tz = await db.Users.Where(u => u.Id == userId)
                .Select(u => u.Timezone).FirstOrDefaultAsync(ct) ?? "UTC";
            var (overdueCutoff, todayEnd, weekEnd) = ComputeBoundaries(tz);
            items = request.Filter.ToLowerInvariant() switch
            {
                "overdue" => items
                    .Where(i => i.DueDate is { } d && d < overdueCutoff).ToList(),
                "today" => items
                    .Where(i => i.DueDate is { } d && d >= overdueCutoff && d < todayEnd).ToList(),
                "week" => items
                    .Where(i => i.DueDate is { } d && d >= todayEnd && d < weekEnd).ToList(),
                _ => items,
            };
        }

        // Stable ordering: due date ascending, nulls last, then created.
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
