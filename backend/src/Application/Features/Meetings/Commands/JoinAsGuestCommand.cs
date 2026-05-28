using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-20 — anonymous guest join. Validates a one-time guest token,
/// then mints a LiveKit access token with subscribe + publish so the
/// guest can speak. Guest identities are namespaced (<c>g:{link-id}</c>)
/// so the F2-21 transcript pipeline can still attribute speech.
/// </summary>
public record JoinAsGuestCommand(string Token, string? DisplayName)
    : IRequest<Result<MeetingJoinTokenDto>>;

public class JoinAsGuestCommandHandler(IAppDbContext db, IVideoService video)
    : IRequestHandler<JoinAsGuestCommand, Result<MeetingJoinTokenDto>>
{
    public async Task<Result<MeetingJoinTokenDto>> Handle(JoinAsGuestCommand request, CancellationToken ct)
    {
        if (!video.IsConfigured)
            return Result.Failure<MeetingJoinTokenDto>(VideoErrors.NotConfigured);

        var token = (request.Token ?? string.Empty).Trim();
        if (token.Length == 0)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.GuestLinkNotFound);

        var link = await db.MeetingGuestLinks
            .Where(g => g.Token == token)
            .Select(g => new
            {
                g.Id, g.MeetingId, g.GuestLabel, g.ExpiresAt, g.RevokedAt,
                MeetingTitle = g.Meeting.Title,
                MeetingStatus = g.Meeting.Status,
                MeetingSeriesId = g.Meeting.SeriesId,
                ScheduledAt = g.Meeting.ScheduledAt,
                DurationMinutes = g.Meeting.DurationMinutes,
                RecordingStartedAt = g.Meeting.RecordingStartedAt,
                RecordingStoppedAt = g.Meeting.RecordingStoppedAt,
            })
            .FirstOrDefaultAsync(ct);
        if (link is null)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.GuestLinkNotFound);
        if (link.RevokedAt is not null || link.ExpiresAt < DateTime.UtcNow)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.GuestLinkExpired);
        if (link.MeetingStatus == MeetingStatus.Cancelled)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.AlreadyCancelled);

        var opensAt = link.ScheduledAt.AddMinutes(-JoinMeetingCommandHandler.PreRoll.TotalMinutes);
        var hardCloseAt = link.ScheduledAt.AddMinutes(link.DurationMinutes + 120);
        var now = DateTime.UtcNow;
        if (now < opensAt)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.TooEarlyToJoin);
        if (now > hardCloseAt)
            return Result.Failure<MeetingJoinTokenDto>(MeetingErrors.AlreadyStarted);

        var displayName = !string.IsNullOrWhiteSpace(request.DisplayName)
            ? request.DisplayName.Trim()
            : (link.GuestLabel ?? "Guest");
        var roomName = MeetingRoom.RoomNameFor(link.MeetingSeriesId);
        var access = video.MintAccessToken(
            roomName: roomName,
            identity: $"g:{link.Id:N}",
            displayName: displayName,
            canPublish: true,
            validFor: TimeSpan.FromMinutes(60));

        var recordingActive = link.RecordingStartedAt is not null
                              && link.RecordingStoppedAt is null;
        return Result.Success(new MeetingJoinTokenDto(
            access.Token, access.Url, access.RoomName,
            access.Identity, access.DisplayName, access.ExpiresAt,
            link.MeetingId, link.MeetingTitle, recordingActive));
    }
}
