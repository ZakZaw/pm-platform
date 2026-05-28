namespace Application.Features.Meetings.Transcripts;

/// <summary>
/// One finalised piece of speech. <see cref="Identity"/> follows the
/// LiveKit convention (<c>u:{userId}</c>, <c>g:{guestLinkId}</c>) so
/// the speaker label is accurate without diarisation, matching the AC.
/// <see cref="DisplayName"/> is what the panel actually renders — kept
/// alongside identity so we don't have to re-resolve to a user row
/// at render time.
/// </summary>
public record TranscriptSegmentDto(
    string Identity,
    string DisplayName,
    string Text,
    DateTime StartedAt,
    DateTime EndedAt);

public record MeetingTranscriptDto(
    Guid MeetingId,
    DateTime? StartedAt,
    DateTime? LastSegmentAt,
    DateTime? FinalisedAt,
    IReadOnlyList<TranscriptSegmentDto> Segments);
