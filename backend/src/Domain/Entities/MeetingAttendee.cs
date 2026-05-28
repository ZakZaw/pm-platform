using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// One row per (<see cref="Meeting"/>, attendee). RSVP responses
/// flow through <c>RespondToMeetingCommand</c>; the row is created at
/// schedule time and the response defaults to
/// <see cref="MeetingRsvp.Pending"/>.
/// </summary>
public class MeetingAttendee
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MeetingId { get; set; }
    public Guid UserId { get; set; }

    public MeetingRsvp Response { get; set; } = MeetingRsvp.Pending;
    public DateTime InvitedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    /// <summary>True when the attendee is required to be present. False
    /// for optional attendees. Surfaces in the UI as an "optional"
    /// pill and feeds the .ics ROLE parameter.</summary>
    public bool Required { get; set; } = true;

    public Meeting Meeting { get; set; } = null!;
    public User User { get; set; } = null!;
}
