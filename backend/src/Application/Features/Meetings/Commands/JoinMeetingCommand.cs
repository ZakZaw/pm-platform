using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-20 — issue a LiveKit access token for the current user to enter
/// the meeting room. The caller must be on the invite list; the room
/// opens 15 minutes before the scheduled start so people can do the
/// usual mic/camera test ahead of time.
/// </summary>
public record JoinMeetingCommand(Guid MeetingId) : IRequest<Result<MeetingJoinTokenDto>>;

public class JoinMeetingCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IVideoService video)
    : IRequestHandler<JoinMeetingCommand, Result<MeetingJoinTokenDto>>
{
    /// <summary>Pre-roll window — match every other "the meeting opens
    /// 15 minutes before" convention people are used to.</summary>
    public static readonly TimeSpan PreRoll = TimeSpan.FromMinutes(15);

    public async Task<Result<MeetingJoinTokenDto>> Handle(JoinMeetingCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingJoinTokenDto>(AuthErrors.NotAuthenticated);
        if (!video.IsConfigured)
            return Result.Failure<MeetingJoinTokenDto>(VideoErrors.NotConfigured);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new
            {
                m.Id, m.SeriesId, m.Title, m.ScheduledAt, m.DurationMinutes, m.Status,
                m.RecordingStartedAt, m.RecordingStoppedAt,
            })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.NotFound);
        if (meeting.Status == MeetingStatus.Cancelled)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.AlreadyCancelled);

        var attendee = await db.MeetingAttendees
            .FirstOrDefaultAsync(a => a.MeetingId == request.MeetingId && a.UserId == userId, ct);
        if (attendee is null)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.NotAttendee);

        // Pre-roll: open the room 15 min before; close it at the
        // scheduled end + 2 hours so an overrun doesn't lock people
        // out mid-meeting.
        var now = DateTime.UtcNow;
        var opensAt = meeting.ScheduledAt.AddMinutes(-PreRoll.TotalMinutes);
        var hardCloseAt = meeting.ScheduledAt.AddMinutes(meeting.DurationMinutes + 120);
        if (now < opensAt)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.TooEarlyToJoin);
        if (now > hardCloseAt)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.AlreadyStarted);

        var me = await db.Users
            .Where(u => u.Id == userId)
            .Select(u => new { u.Id, u.FullName, u.Email })
            .FirstAsync(ct);

        var roomName = MeetingRoom.RoomNameFor(meeting.SeriesId);
        var access = video.MintAccessToken(
            roomName: roomName,
            identity: $"u:{me.Id:N}",
            displayName: string.IsNullOrWhiteSpace(me.FullName) ? me.Email : me.FullName,
            canPublish: true,
            validFor: TimeSpan.FromMinutes(60));

        // RSVP nudge: a join implies attendance, so if they hadn't
        // confirmed we flip Pending -> Accepted.
        if (attendee.Response == MeetingRsvp.Pending)
        {
            attendee.Response = MeetingRsvp.Accepted;
            attendee.RespondedAt = now;
            await db.SaveChangesAsync(ct);
        }

        var recordingActive = meeting.RecordingStartedAt is not null
                              && meeting.RecordingStoppedAt is null;
        return Result.Success(new MeetingJoinTokenDto(
            access.Token, access.Url, access.RoomName,
            access.Identity, access.DisplayName, access.ExpiresAt,
            meeting.Id, meeting.Title, recordingActive));
    }
}
