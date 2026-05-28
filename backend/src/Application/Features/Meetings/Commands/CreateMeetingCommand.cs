using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Task = System.Threading.Tasks.Task;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-19 — schedule a new meeting. Caller becomes organiser; the
/// attendee list must be a subset of the project's members so meetings
/// can't accidentally leak across project boundaries.
///
/// Recurrence: a non-null <see cref="RecurrenceRule"/> stores the RRULE
/// directly on the row. The series is collapsed (one row, not N
/// instances) — F2-19's AC is "recurring meetings create a series with
/// one logical link", which the <see cref="Meeting.SeriesId"/>
/// already covers.
/// </summary>
public record CreateMeetingCommand(
    Guid ProjectId,
    string Title,
    string? Description,
    string Type,
    DateTime ScheduledAt,
    int DurationMinutes,
    string? RecurrenceRule,
    string? AgendaMd,
    bool AgendaFromAi,
    IReadOnlyList<MeetingAttendeeInput> Attendees) : IRequest<Result<MeetingDetailDto>>;

public record MeetingAttendeeInput(Guid UserId, bool Required);

public class CreateMeetingCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IEmailService emailService,
    IcsCalendarWriter ics)
    : IRequestHandler<CreateMeetingCommand, Result<MeetingDetailDto>>
{
    public async Task<Result<MeetingDetailDto>> Handle(CreateMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } organiserId)
            return Result.Failure<MeetingDetailDto>(AuthErrors.NotAuthenticated);

        if (MeetingValidation.ValidateTitle(request.Title) is { } titleErr)
            return Result.Failure<MeetingDetailDto>(titleErr);
        if (MeetingValidation.ValidateDuration(request.DurationMinutes) is { } durErr)
            return Result.Failure<MeetingDetailDto>(durErr);
        if (MeetingValidation.ValidateScheduledAt(request.ScheduledAt, DateTime.UtcNow) is { } whenErr)
            return Result.Failure<MeetingDetailDto>(whenErr);
        if (MeetingValidation.ValidateRecurrence(request.RecurrenceRule) is { } rrErr)
            return Result.Failure<MeetingDetailDto>(rrErr);

        var typeResult = MeetingValidation.ParseType(request.Type);
        if (!typeResult.IsSuccess)
            return Result.Failure<MeetingDetailDto>(typeResult.Error!);

        // Caller must be on the project.
        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.OrganizationId })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<MeetingDetailDto>(ProjectErrors.NotFound);

        var callerIsMember = await db.ProjectMemberships.AnyAsync(
            m => m.ProjectId == request.ProjectId && m.UserId == organiserId, ct);
        if (!callerIsMember)
            return Result.Failure<MeetingDetailDto>(ProjectErrors.NotFound);

        // Normalise attendee list: drop the caller (always added),
        // drop dupes, keep order so the email list reads sensibly.
        var inputs = new List<MeetingAttendeeInput>();
        var seen = new HashSet<Guid> { organiserId };
        foreach (var a in request.Attendees ?? [])
        {
            if (a.UserId == Guid.Empty) continue;
            if (!seen.Add(a.UserId)) continue;
            inputs.Add(a);
        }
        if (inputs.Count == 0)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.AttendeesRequired);

        var attendeeIds = inputs.Select(a => a.UserId).ToList();
        var memberIds = await db.ProjectMemberships
            .Where(m => m.ProjectId == request.ProjectId && attendeeIds.Contains(m.UserId))
            .Select(m => m.UserId)
            .ToListAsync(ct);
        if (memberIds.Count != attendeeIds.Count)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.AttendeeNotInProject);

        var meeting = new Meeting
        {
            ProjectId = request.ProjectId,
            OrganizerId = organiserId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Type = typeResult.Value,
            ScheduledAt = request.ScheduledAt.ToUniversalTime(),
            DurationMinutes = request.DurationMinutes,
            RecurrenceRule = string.IsNullOrWhiteSpace(request.RecurrenceRule)
                ? null
                : request.RecurrenceRule!.Trim(),
            AgendaMd = string.IsNullOrWhiteSpace(request.AgendaMd) ? null : request.AgendaMd!.Trim(),
            AgendaFromAi = request.AgendaFromAi && !string.IsNullOrWhiteSpace(request.AgendaMd),
        };
        meeting.SeriesId = meeting.Id; // a fresh series rooted at this row
        db.Meetings.Add(meeting);

        // Organiser is implicitly attending — saves the "I scheduled
        // it but I'm not on the list" foot-gun. Marked Accepted because
        // they explicitly chose the slot.
        db.MeetingAttendees.Add(new MeetingAttendee
        {
            MeetingId = meeting.Id,
            UserId = organiserId,
            Required = true,
            Response = Domain.Enums.MeetingRsvp.Accepted,
            RespondedAt = DateTime.UtcNow,
        });
        foreach (var input in inputs)
        {
            db.MeetingAttendees.Add(new MeetingAttendee
            {
                MeetingId = meeting.Id,
                UserId = input.UserId,
                Required = input.Required,
            });
        }

        await db.SaveChangesAsync(ct);

        // Fire-and-forget the .ics invite email after the row is
        // durable. Failures here shouldn't roll back scheduling — the
        // organiser can resend from the detail page.
        await TrySendInviteAsync(meeting.Id, ct);

        var dto = await MeetingProjection.LoadDetailAsync(db, meeting.Id, ct);
        return Result.Success(dto!);
    }

    private async Task TrySendInviteAsync(Guid meetingId, CancellationToken ct)
    {
        var meeting = await db.Meetings
            .Where(m => m.Id == meetingId)
            .Select(m => new
            {
                m.Id, m.SeriesId, m.Title, m.Description,
                m.ScheduledAt, m.DurationMinutes, m.RecurrenceRule,
                OrganiserName = m.Organizer.FullName,
                OrganiserEmail = m.Organizer.Email,
            })
            .FirstAsync(ct);

        var attendees = await db.MeetingAttendees
            .Where(a => a.MeetingId == meetingId)
            .Select(a => new
            {
                a.User.FullName, a.User.Email, a.Required,
                IsOrganiser = a.UserId == db.Meetings.Where(m => m.Id == meetingId).Select(m => m.OrganizerId).First(),
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
            recurrenceRule: meeting.RecurrenceRule);

        var toEmails = attendees
            .Where(a => !a.IsOrganiser)
            .Select(a => a.Email)
            .ToList();

        try
        {
            await emailService.SendMeetingInviteAsync(
                toEmails: toEmails,
                organiserFullName: meeting.OrganiserName,
                organiserEmail: meeting.OrganiserEmail,
                subject: $"Invitation: {meeting.Title}",
                bodyMd: meeting.Description ?? string.Empty,
                icsBody: icsBody,
                ct: ct);
        }
        catch
        {
            // Swallow — the row is saved; the organiser can resend.
        }
    }
}
