namespace Application.Interfaces;

public interface IEmailService
{
    Task SendInvitationAsync(
        string toEmail,
        string organizationName,
        string inviterFullName,
        string invitedRole,
        string invitationToken,
        DateTime expiresAtUtc,
        CancellationToken ct = default);

    /// <summary>
    /// F2-19 — send a calendar invite with the .ics body attached as a
    /// <c>text/calendar; method=REQUEST</c> part. Each recipient gets
    /// the same payload; the .ics generator embeds per-attendee
    /// ATTENDEE lines so calendar clients still wire RSVP correctly.
    /// </summary>
    Task SendMeetingInviteAsync(
        IReadOnlyList<string> toEmails,
        string organiserFullName,
        string organiserEmail,
        string subject,
        string bodyMd,
        string icsBody,
        CancellationToken ct = default);
}
