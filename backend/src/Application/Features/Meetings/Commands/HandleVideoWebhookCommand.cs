using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Features.Meetings.Commands;

/// <summary>
/// F2-20 — receive a LiveKit webhook. The provider posts events
/// (<c>room_started</c>, <c>participant_joined</c>,
/// <c>participant_left</c>, <c>egress_started</c>,
/// <c>egress_ended</c>) keyed by room name. We translate the room
/// name back to a meeting and maintain the recording lifecycle from
/// the AC:
///
///   "Recording starts when first 2 participants join,
///    stops on last leave."
///
/// Signature verification lives on the controller side via
/// <see cref="IVideoService.VerifyWebhookSignature"/>; this handler
/// trusts that the payload has already passed.
/// </summary>
public record HandleVideoWebhookCommand(string PayloadJson) : IRequest<Result<Unit>>;

public class HandleVideoWebhookCommandHandler(
    IAppDbContext db,
    IVideoService video,
    ILogger<HandleVideoWebhookCommandHandler> logger)
    : IRequestHandler<HandleVideoWebhookCommand, Result<Unit>>
{
    public async Task<Result<Unit>> Handle(HandleVideoWebhookCommand request, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(request.PayloadJson);
        var root = doc.RootElement;
        var eventName = root.TryGetProperty("event", out var ev) ? ev.GetString() ?? "" : "";
        var roomName = root.TryGetProperty("room", out var room)
                       && room.TryGetProperty("name", out var rn)
            ? rn.GetString() ?? ""
            : "";
        if (string.IsNullOrEmpty(eventName) || string.IsNullOrEmpty(roomName))
            return Result.Success(Unit.Value); // ignore malformed events

        // Room names follow MeetingRoom.RoomNameFor(seriesId).
        if (!TryParseSeriesId(roomName, out var seriesId))
            return Result.Success(Unit.Value);

        // Single active meeting per series — match on the next non-
        // cancelled occurrence that is currently in its join window.
        // Falls back to the latest scheduled instance so a recording-
        // ended event after the meeting's hard close still records.
        var meeting = await db.Meetings
            .Where(m => m.SeriesId == seriesId
                     && m.Status != Domain.Enums.MeetingStatus.Cancelled)
            .OrderByDescending(m => m.ScheduledAt)
            .FirstOrDefaultAsync(ct);
        if (meeting is null) return Result.Success(Unit.Value);

        switch (eventName)
        {
            case "participant_joined":
                meeting.ActiveParticipantCount++;
                // 0 -> 1 doesn't trigger recording; 1 -> 2 does (AC).
                if (meeting.ActiveParticipantCount >= 2
                    && meeting.RecordingStartedAt is null)
                {
                    var egressId = await video.StartRoomRecordingAsync(roomName, ct);
                    meeting.RecordingStartedAt = DateTime.UtcNow;
                    meeting.RecordingEgressId = egressId;
                }
                break;

            case "participant_left":
                if (meeting.ActiveParticipantCount > 0) meeting.ActiveParticipantCount--;
                // Last leave -> stop recording. ActiveParticipantCount
                // can briefly go negative if events arrive out of order;
                // we clamp at 0 so the next correct join doesn't get
                // double-counted.
                if (meeting.ActiveParticipantCount <= 0
                    && meeting.RecordingStartedAt is not null
                    && meeting.RecordingStoppedAt is null)
                {
                    if (!string.IsNullOrEmpty(meeting.RecordingEgressId))
                        await video.StopRoomRecordingAsync(meeting.RecordingEgressId, ct);
                    meeting.RecordingStoppedAt = DateTime.UtcNow;
                    meeting.ActiveParticipantCount = 0;
                }
                break;

            case "egress_ended":
                // LiveKit sends the final file URL once egress has
                // uploaded. Persist it so the post-meeting screen can
                // show "Recording (24 min)" with a download link.
                if (root.TryGetProperty("egressInfo", out var info)
                    && info.TryGetProperty("file", out var file)
                    && file.TryGetProperty("location", out var loc))
                {
                    meeting.RecordingUrl = loc.GetString();
                    meeting.RecordingStoppedAt ??= DateTime.UtcNow;
                }
                break;

            case "room_finished":
                meeting.ActiveParticipantCount = 0;
                meeting.RecordingStoppedAt ??= DateTime.UtcNow;
                break;

            default:
                logger.LogDebug("Unhandled LiveKit event {Event} on room {Room}", eventName, roomName);
                break;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(Unit.Value);
    }

    private static bool TryParseSeriesId(string roomName, out Guid seriesId)
    {
        seriesId = Guid.Empty;
        const string prefix = "meeting-";
        if (!roomName.StartsWith(prefix, StringComparison.Ordinal)) return false;
        return Guid.TryParseExact(roomName[prefix.Length..], "N", out seriesId);
    }
}
