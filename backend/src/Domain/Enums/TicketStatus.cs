namespace Domain.Enums;

/// <summary>
/// Support ticket lifecycle. Closed and Resolved are both terminal-ish
/// (no SLA pressure, hidden from default queue views) but stay distinct:
/// Resolved means "we believe this is done"; Closed means the customer
/// confirmed or it auto-closed after the resolution window.
/// </summary>
public enum TicketStatus
{
    New,
    Open,
    Pending,
    Resolved,
    Closed,
    Reopened
}
