using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Queries;

/// <summary>
/// List meetings on a project, optionally filtered by an upcoming /
/// past window. The "upcoming" path is the default — what the
/// Meetings tab opens to.
/// </summary>
public record ListProjectMeetingsQuery(
    Guid ProjectId,
    bool IncludePast,
    bool IncludeCancelled)
    : IRequest<Result<IReadOnlyList<MeetingListItemDto>>>;

public class ListProjectMeetingsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListProjectMeetingsQuery, Result<IReadOnlyList<MeetingListItemDto>>>
{
    public async Task<Result<IReadOnlyList<MeetingListItemDto>>> Handle(
        ListProjectMeetingsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<MeetingListItemDto>>(AuthErrors.NotAuthenticated);

        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<IReadOnlyList<MeetingListItemDto>>(ProjectErrors.NotFound);

        var now = DateTime.UtcNow;
        var query = db.Meetings.Where(m => m.ProjectId == request.ProjectId);
        if (!request.IncludeCancelled)
            query = query.Where(m => m.Status != MeetingStatus.Cancelled);
        if (!request.IncludePast)
            query = query.Where(m => m.ScheduledAt >= now.AddHours(-1));

        var rows = await query
            .OrderBy(m => m.ScheduledAt)
            .Select(m => new
            {
                m.Id, m.SeriesId, m.Title, m.Type, m.Status,
                m.ScheduledAt, m.DurationMinutes, m.RecurrenceRule,
                m.OrganizerId,
                OrganizerFullName = m.Organizer.FullName,
                AttendeeCount = m.Attendees.Count,
                AcceptedCount = m.Attendees.Count(a => a.Response == MeetingRsvp.Accepted),
                MyResponse = m.Attendees
                    .Where(a => a.UserId == userId)
                    .Select(a => (string?)a.Response.ToString())
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var items = rows.Select(r => new MeetingListItemDto(
            r.Id, r.SeriesId, r.Title, r.Type.ToString(), r.Status.ToString(),
            r.ScheduledAt, r.DurationMinutes,
            !string.IsNullOrWhiteSpace(r.RecurrenceRule),
            r.OrganizerId, r.OrganizerFullName,
            r.AttendeeCount, r.AcceptedCount, r.MyResponse)).ToList();
        return Result.Success<IReadOnlyList<MeetingListItemDto>>(items);
    }
}
