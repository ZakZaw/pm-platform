namespace Domain.Enums;

/// <summary>
/// F2-19 — attendee RSVP. <c>Pending</c> is the implicit state on
/// invite; the other three correspond to standard calendar
/// PARTSTAT values so the .ics export round-trips cleanly with
/// Outlook / Google Calendar.
/// </summary>
public enum MeetingRsvp
{
    Pending = 0,
    Accepted = 1,
    Declined = 2,
    Tentative = 3,
}
