namespace Domain.Entities;

/// <summary>
/// F2-21 — single row per <see cref="Meeting"/> that accumulates every
/// finalised transcript segment as the meeting runs. Segments stay in
/// a single JSON column rather than a child table because (a) the
/// roadmap line item names <c>segments_json</c> directly, (b) we read
/// the whole transcript at once for the post-meeting AI pipeline that
/// lands in F2-22, and (c) JSONB on Postgres lets us still query into
/// the segments if we ever need to.
///
/// <para>
/// Speaker labels follow the LiveKit identity convention — <c>u:{userId}</c>
/// for signed-in users, <c>g:{guestLinkId}</c> for guests — so the
/// label is accurate without voice diarisation, matching the AC.
/// </para>
/// </summary>
public class MeetingTranscript
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MeetingId { get; set; }

    /// <summary>JSON array of <c>{ identity, displayName, text,
    /// startedAt, endedAt }</c>. We let Application own the segment
    /// shape so Domain doesn't take a JSON dep.</summary>
    public string SegmentsJson { get; set; } = "[]";

    /// <summary>
    /// First time we received a segment for this meeting — useful for
    /// the post-meeting summary ("transcript spans 14:02 → 14:38").
    /// Null until the first segment arrives.
    /// </summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>
    /// Last time we received a segment. Refreshed on every append so
    /// we can detect a meeting that ended without a clean close.
    /// </summary>
    public DateTime? LastSegmentAt { get; set; }

    /// <summary>
    /// Stamped when the meeting moves to <c>Completed</c> so the
    /// post-meeting AI pipeline can lock the transcript before it
    /// runs. Until then the row is append-only.
    /// </summary>
    public DateTime? FinalisedAt { get; set; }

    public Meeting Meeting { get; set; } = null!;
}
