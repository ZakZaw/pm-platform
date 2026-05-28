using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Task = System.Threading.Tasks.Task;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-19 — cancel a scheduled meeting. Organiser only. Stamps
/// <see cref="MeetingStatus.Cancelled"/> and ships a CANCEL .ics to
/// every attendee so the event drops from their calendar.
/// </summary>
public record CancelMeetingCommand(Guid MeetingId) : IRequest<Result<Guid>>;

public class CancelMeetingCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IEmailService emailService,
    IcsCalendarWriter ics)
    : IRequestHandler<CancelMeetingCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(CancelMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<Guid>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<Guid>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<Guid>(MeetingErrors.NotOrganiser);
        if (meeting.Status == MeetingStatus.Cancelled)
            return Result.Failure<Guid>(MeetingErrors.AlreadyCancelled);

        meeting.Status = MeetingStatus.Cancelled;
        meeting.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await TrySendCancelAsync(meeting.Id, ct);
        return Result.Success(meeting.Id);
    }

    private async Task TrySendCancelAsync(Guid meetingId, CancellationToken ct)
    {
        var meeting = await db.Meetings
            .Where(m => m.Id == meetingId)
            .Select(m => new
            {
                m.Id, m.SeriesId, m.Title, m.Description,
                m.ScheduledAt, m.DurationMinutes, m.RecurrenceRule,
                OrganiserId = m.OrganizerId,
                OrganiserName = m.Organizer.FullName,
                OrganiserEmail = m.Organizer.Email,
            })
            .FirstAsync(ct);

        var attendees = await db.MeetingAttendees
            .Where(a => a.MeetingId == meetingId)
            .Select(a => new
            {
                a.UserId, a.User.FullName, a.User.Email, a.Required,
            })
            .ToListAsync(ct);

        var icsAttendees = attendees
            .Select(a => new IcsCalendarWriter.IcsAttendee(a.Email, a.FullName, a.Required))
            .ToList();
        var icsBody = ics.Build(
            seriesId: meeting.SeriesId,
            startUtc: meeting.ScheduledAt,
            durationMinutes: meeting.DurationMinutes,
            summary: meeting.Title,
            description: meeting.Description,
            organiserEmail: meeting.OrganiserEmail,
            organiserFullName: meeting.OrganiserName,
            attendees: icsAttendees,
            recurrenceRule: meeting.RecurrenceRule,
            cancelled: true);

        var toEmails = attendees
            .Where(a => a.UserId != meeting.OrganiserId)
            .Select(a => a.Email)
            .ToList();
        try
        {
            await emailService.SendMeetingInviteAsync(
                toEmails, meeting.OrganiserName, meeting.OrganiserEmail,
                $"Cancelled: {meeting.Title}",
                meeting.Description ?? string.Empty, icsBody, ct);
        }
        catch
        {
            // Best-effort.
        }
    }
}
