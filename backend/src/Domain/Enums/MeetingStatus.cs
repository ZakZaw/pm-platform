namespace Domain.Enums;

/// <summary>
/// F2-19 — lifecycle of a Meeting. <c>Scheduled</c> on create; the AC
/// allows agenda edits up until <c>InProgress</c>. <c>Cancelled</c>
/// keeps the row (auditing, attendee history) but releases conflicts.
/// <c>Completed</c> drives the post-meeting AI processing that lands
/// in F2-22.
/// </summary>
public enum MeetingStatus
{
    Scheduled = 0,
    InProgress = 1,
    Completed = 2,
    Cancelled = 3,
}
