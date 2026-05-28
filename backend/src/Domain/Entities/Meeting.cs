using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// F2-19 — a scheduled meeting attached to a project. Stores the
/// occurrence's anchor time, agenda markdown, and an optional RRULE for
/// recurrence. The series itself is collapsed to a single row: instead
/// of materialising every instance we keep the rule and let the UI
/// expand it lazily.
///
/// <para>
/// <c>SeriesId</c> is the stable group key — for a one-off meeting it
/// equals <see cref="Id"/>; for a recurring series every instance
/// (including the master row) shares the same SeriesId. When the
/// organiser "edits this and following" we close the existing series
/// and open a new one — same pattern Outlook and Google Calendar use.
/// </para>
/// </summary>
public class Meeting
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Stable group key shared across every occurrence in a
    /// recurring series. Single one-off meetings have
    /// <see cref="SeriesId"/> == <see cref="Id"/>.</summary>
    public Guid SeriesId { get; set; }

    public Guid ProjectId { get; set; }
    public Guid OrganizerId { get; set; }

    public required string Title { get; set; }
    public string? Description { get; set; }
    public MeetingType Type { get; set; }
    public MeetingStatus Status { get; set; } = MeetingStatus.Scheduled;

    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }

    /// <summary>
    /// iCalendar RRULE string for recurring meetings, e.g.
    /// <c>"FREQ=WEEKLY;BYDAY=MO"</c>. Null for one-off meetings. We
    /// store the raw rule because round-tripping through a typed model
    /// loses fidelity (BYSETPOS, EXDATE, etc.) that we'll want when
    /// real calendar sync lands.
    /// </summary>
    public string? RecurrenceRule { get; set; }

    public string? AgendaMd { get; set; }

    /// <summary>True when the agenda came from
    /// <c>GenerateMeetingAgendaAsync</c>. Surfaces an "AI draft" chip
    /// on the page and powers the audit log.</summary>
    public bool AgendaFromAi { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // F2-20 — live room state. ActiveParticipantCount is the truth
    // the LiveKit webhook stream maintains; recording start/stop are
    // driven from the 0->2 and last-leaves transitions on that count.
    public int ActiveParticipantCount { get; set; }
    public string? RecordingEgressId { get; set; }
    public DateTime? RecordingStartedAt { get; set; }
    public DateTime? RecordingStoppedAt { get; set; }
    public string? RecordingUrl { get; set; }

    public Project Project { get; set; } = null!;
    public User Organizer { get; set; } = null!;
    public ICollection<MeetingAttendee> Attendees { get; set; } = [];
    public ICollection<MeetingGuestLink> GuestLinks { get; set; } = [];
}
