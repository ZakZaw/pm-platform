using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-19 — edit a scheduled meeting. Organiser only. Agenda edits are
/// allowed up until <see cref="MeetingStatus.InProgress"/> per AC;
/// title / time / attendee changes follow the same gate. Optional
/// scalars (<c>null</c>) leave the field untouched; the boolean
/// <c>Clear*</c> flags express "remove this value" explicitly so we
/// don't conflate "no change" with "set to null".
/// </summary>
public record UpdateMeetingCommand(
    Guid MeetingId,
    string? Title,
    string? Description,
    bool ClearDescription,
    string? Type,
    DateTime? ScheduledAt,
    int? DurationMinutes,
    string? RecurrenceRule,
    bool ClearRecurrence,
    string? AgendaMd,
    bool ClearAgenda,
    bool? AgendaFromAi,
    IReadOnlyList<MeetingAttendeeInput>? Attendees) : IRequest<Result<MeetingDetailDto>>;

public class UpdateMeetingCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<UpdateMeetingCommand, Result<MeetingDetailDto>>
{
    public async Task<Result<MeetingDetailDto>> Handle(UpdateMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingDetailDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .FirstOrDefaultAsync(m => m.Id == request.MeetingId, ct);
        if (meeting is null)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotFound);
        if (meeting.OrganizerId != userId)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.NotOrganiser);
        if (meeting.Status is MeetingStatus.InProgress or MeetingStatus.Completed)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.AlreadyStarted);
        if (meeting.Status == MeetingStatus.Cancelled)
            return Result.Failure<MeetingDetailDto>(MeetingErrors.AlreadyCancelled);

        if (request.Title is not null)
        {
            if (MeetingValidation.ValidateTitle(request.Title) is { } err)
                return Result.Failure<MeetingDetailDto>(err);
            meeting.Title = request.Title.Trim();
        }

        if (request.ClearDescription) meeting.Description = null;
        else if (request.Description is not null)
            meeting.Description = string.IsNullOrWhiteSpace(request.Description)
                ? null : request.Description.Trim();

        if (request.Type is not null)
        {
            var typeResult = MeetingValidation.ParseType(request.Type);
            if (!typeResult.IsSuccess)
                return Result.Failure<MeetingDetailDto>(typeResult.Error!);
            meeting.Type = typeResult.Value;
        }

        if (request.ScheduledAt is { } when)
        {
            if (MeetingValidation.ValidateScheduledAt(when, DateTime.UtcNow) is { } err)
                return Result.Failure<MeetingDetailDto>(err);
            meeting.ScheduledAt = when.ToUniversalTime();
        }

        if (request.DurationMinutes is { } dur)
        {
            if (MeetingValidation.ValidateDuration(dur) is { } err)
                return Result.Failure<MeetingDetailDto>(err);
            meeting.DurationMinutes = dur;
        }

        if (request.ClearRecurrence) meeting.RecurrenceRule = null;
        else if (request.RecurrenceRule is not null)
        {
            if (MeetingValidation.ValidateRecurrence(request.RecurrenceRule) is { } err)
                return Result.Failure<MeetingDetailDto>(err);
            meeting.RecurrenceRule = request.RecurrenceRule.Trim();
        }

        if (request.ClearAgenda)
        {
            meeting.AgendaMd = null;
            meeting.AgendaFromAi = false;
        }
        else if (request.AgendaMd is not null)
        {
            meeting.AgendaMd = string.IsNullOrWhiteSpace(request.AgendaMd)
                ? null : request.AgendaMd.Trim();
            if (request.AgendaFromAi is { } flag) meeting.AgendaFromAi = flag;
        }
        else if (request.AgendaFromAi is { } flagOnly)
        {
            meeting.AgendaFromAi = flagOnly;
        }

        if (request.Attendees is not null)
        {
            var inputs = new List<MeetingAttendeeInput>();
            var seen = new HashSet<Guid> { meeting.OrganizerId };
            foreach (var a in request.Attendees)
            {
                if (a.UserId == Guid.Empty) continue;
                if (!seen.Add(a.UserId)) continue;
                inputs.Add(a);
            }
            if (inputs.Count == 0)
                return Result.Failure<MeetingDetailDto>(MeetingErrors.AttendeesRequired);

            var ids = inputs.Select(a => a.UserId).ToList();
            var memberCount = await db.ProjectMemberships
                .CountAsync(m => m.ProjectId == meeting.ProjectId && ids.Contains(m.UserId), ct);
            if (memberCount != ids.Count)
                return Result.Failure<MeetingDetailDto>(MeetingErrors.AttendeeNotInProject);

            var current = await db.MeetingAttendees
                .Where(a => a.MeetingId == meeting.Id)
                .ToListAsync(ct);
            var keepIds = new HashSet<Guid>(inputs.Select(i => i.UserId)) { meeting.OrganizerId };

            foreach (var a in current)
            {
                if (!keepIds.Contains(a.UserId))
                    db.MeetingAttendees.Remove(a);
            }
            var existingIds = current.Select(a => a.UserId).ToHashSet();
            foreach (var input in inputs)
            {
                if (existingIds.Contains(input.UserId))
                {
                    var row = current.First(a => a.UserId == input.UserId);
                    row.Required = input.Required;
                }
                else
                {
                    db.MeetingAttendees.Add(new Domain.Entities.MeetingAttendee
                    {
                        MeetingId = meeting.Id,
                        UserId = input.UserId,
                        Required = input.Required,
                    });
                }
            }
        }

        meeting.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var dto = await MeetingProjection.LoadDetailAsync(db, meeting.Id, ct);
        return Result.Success(dto!);
    }
}
