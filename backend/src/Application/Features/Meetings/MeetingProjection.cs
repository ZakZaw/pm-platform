using Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings;

/// <summary>
/// Centralised projections from <c>Meeting</c> rows to the F2-19 DTOs.
/// Owning DTO shape here means every command's "return the fresh
/// row" path is one method call.
/// </summary>
internal static class MeetingProjection
{
    public static async Task<MeetingDetailDto?> LoadDetailAsync(
        IAppDbContext db, Guid meetingId, CancellationToken ct)
    {
        var row = await db.Meetings
            .Where(m => m.Id == meetingId)
            .Select(m => new
            {
                m.Id, m.SeriesId, m.ProjectId,
                ProjectName = m.Project.Name,
                ProjectSlug = m.Project.Slug,
                m.Title, m.Description, m.Type, m.Status,
                m.ScheduledAt, m.DurationMinutes,
                m.RecurrenceRule, m.AgendaMd, m.AgendaFromAi,
                m.OrganizerId,
                OrganizerFullName = m.Organizer.FullName,
                OrganizerEmail = m.Organizer.Email,
                m.CreatedAt, m.UpdatedAt,
            })
            .FirstOrDefaultAsync(ct);
        if (row is null) return null;

        var attendees = await db.MeetingAttendees
            .Where(a => a.MeetingId == meetingId)
            .OrderBy(a => a.User.FullName)
            .Select(a => new MeetingAttendeeDto(
                a.UserId, a.User.FullName, a.User.Email, a.User.AvatarUrl,
                a.Required, a.Response.ToString(), a.RespondedAt))
            .ToListAsync(ct);

        return new MeetingDetailDto(
            row.Id, row.SeriesId, row.ProjectId, row.ProjectName, row.ProjectSlug,
            row.Title, row.Description, row.Type.ToString(), row.Status.ToString(),
            row.ScheduledAt, row.DurationMinutes, row.RecurrenceRule,
            row.AgendaMd, row.AgendaFromAi,
            row.OrganizerId, row.OrganizerFullName, row.OrganizerEmail,
            row.CreatedAt, row.UpdatedAt, attendees);
    }
}
