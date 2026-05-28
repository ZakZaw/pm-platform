using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Transcripts;

/// <summary>
/// F2-21 — append one finalised speech segment to a meeting's
/// transcript and fan it out to every other client in the room via
/// SignalR. The client emits one of these per Web Speech API "final"
/// result (or one per Deepgram <c>is_final</c> frame in the production
/// path); partial results stay client-only so they don't double-bill
/// the DB.
///
/// The caller's identity is enforced server-side from the auth claim —
/// the body's <c>identity</c> / <c>displayName</c> can't lie about
/// who's speaking. We allow guests (no auth claim) by accepting any
/// identity that already exists on a participant of this meeting; the
/// hub's <c>JoinMeeting</c> gates room membership.
/// </summary>
public record PostTranscriptSegmentCommand(
    Guid MeetingId,
    string Text,
    DateTime StartedAt,
    DateTime EndedAt) : IRequest<Result<TranscriptSegmentDto>>;

public class PostTranscriptSegmentCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IProjectEventBus events)
    : IRequestHandler<PostTranscriptSegmentCommand, Result<TranscriptSegmentDto>>
{
    public const int MaxTextLength = 2_000;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<TranscriptSegmentDto>> Handle(
        PostTranscriptSegmentCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TranscriptSegmentDto>(AuthErrors.NotAuthenticated);

        var text = (request.Text ?? string.Empty).Trim();
        if (text.Length == 0)
            return Result.Failure<TranscriptSegmentDto>(TranscriptErrors.EmptyText);
        if (text.Length > MaxTextLength)
            return Result.Failure<TranscriptSegmentDto>(TranscriptErrors.TooLong);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.Status })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<TranscriptSegmentDto>(MeetingErrors.NotFound);

        // The caller must be on the invite list — same access gate the
        // join endpoint applies. We don't accept guests through this
        // path for the first cut; their browser still renders the
        // transcript from SignalR, they just don't contribute segments.
        var attendee = await db.MeetingAttendees
            .Where(a => a.MeetingId == request.MeetingId && a.UserId == userId)
            .Select(a => new { a.User.FullName, a.User.Email })
            .FirstOrDefaultAsync(ct);
        if (attendee is null)
            return Result.Failure<TranscriptSegmentDto>(MeetingErrors.NotAttendee);

        var identity = $"u:{userId:N}";
        var displayName = string.IsNullOrWhiteSpace(attendee.FullName)
            ? attendee.Email : attendee.FullName;

        var transcript = await db.MeetingTranscripts
            .FirstOrDefaultAsync(t => t.MeetingId == request.MeetingId, ct);
        if (transcript is null)
        {
            transcript = new MeetingTranscript
            {
                MeetingId = request.MeetingId,
                StartedAt = request.StartedAt,
            };
            db.MeetingTranscripts.Add(transcript);
        }
        if (transcript.FinalisedAt is not null)
            return Result.Failure<TranscriptSegmentDto>(TranscriptErrors.AlreadyFinalised);

        var segment = new TranscriptSegmentDto(
            identity, displayName, text,
            request.StartedAt.ToUniversalTime(),
            request.EndedAt.ToUniversalTime());

        // Append to the JSON column. We deserialise on every write
        // because Postgres' jsonb_array_append needs a raw SQL fragment
        // we don't want to depend on; one round-trip per segment is
        // fine — these arrive at speech cadence, not key-press cadence.
        var existing = JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(
            transcript.SegmentsJson, JsonOpts) ?? [];
        existing.Add(segment);
        transcript.SegmentsJson = JsonSerializer.Serialize(existing, JsonOpts);
        transcript.LastSegmentAt = segment.EndedAt;
        transcript.StartedAt ??= segment.StartedAt;

        await db.SaveChangesAsync(ct);

        await events.PublishToMeetingAsync(
            request.MeetingId, MeetingEvents.TranscriptSegment, segment, ct);

        return Result.Success(segment);
    }
}
