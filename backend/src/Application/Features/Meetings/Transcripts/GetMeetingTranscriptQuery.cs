using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Meetings.Transcripts;

/// <summary>
/// F2-21 — fetch a meeting's accumulated transcript. Used by the
/// MeetingRoomPage's initial paint (so a late joiner sees everything
/// said so far) and the post-meeting download paths.
/// </summary>
public record GetMeetingTranscriptQuery(Guid MeetingId) : IRequest<Result<MeetingTranscriptDto>>;

public class GetMeetingTranscriptQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMeetingTranscriptQuery, Result<MeetingTranscriptDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<MeetingTranscriptDto>> Handle(
        GetMeetingTranscriptQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MeetingTranscriptDto>(AuthErrors.NotAuthenticated);

        var meeting = await db.Meetings
            .Where(m => m.Id == request.MeetingId)
            .Select(m => new { m.Id, m.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (meeting is null)
            return Result.Failure<MeetingTranscriptDto>(MeetingErrors.NotFound);

        // Any project member can read the transcript — matches the
        // F2-19 detail-page gate so a PM who wasn't on the invite can
        // still review the recording.
        var isMember = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == meeting.ProjectId && m.UserId == userId, ct);
        if (!isMember)
            return Result.Failure<MeetingTranscriptDto>(MeetingErrors.NotFound);

        var row = await db.MeetingTranscripts
            .FirstOrDefaultAsync(t => t.MeetingId == request.MeetingId, ct);

        var segments = row is null
            ? new List<TranscriptSegmentDto>()
            : JsonSerializer.Deserialize<List<TranscriptSegmentDto>>(row.SegmentsJson, JsonOpts)
              ?? new List<TranscriptSegmentDto>();
        return Result.Success(new MeetingTranscriptDto(
            request.MeetingId,
            row?.StartedAt,
            row?.LastSegmentAt,
            row?.FinalisedAt,
            segments));
    }
}
