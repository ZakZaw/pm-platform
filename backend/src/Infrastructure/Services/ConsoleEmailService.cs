using Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class FrontendSettings
{
    public string BaseUrl { get; set; } = "http://localhost:5173";
}

// Dev stub. Prints the invitation link to the host log so the developer can
// open it manually. Swap with a real SMTP/SendGrid/SES implementation in
// production by replacing the IEmailService registration.
public class ConsoleEmailService(
    ILogger<ConsoleEmailService> logger,
    IOptions<FrontendSettings> frontend)
    : IEmailService
{
    private readonly string _frontendBaseUrl = frontend.Value.BaseUrl.TrimEnd('/');

    public Task SendInvitationAsync(
        string toEmail,
        string organizationName,
        string inviterFullName,
        string invitedRole,
        string invitationToken,
        DateTime expiresAtUtc,
        CancellationToken ct = default)
    {
        var acceptUrl = $"{_frontendBaseUrl}/invitations/{invitationToken}";

        logger.LogInformation(
            "[invitation] to={Email} org=\"{Org}\" inviter=\"{Inviter}\" role={Role} expires={Expires:O} link={Link}",
            toEmail, organizationName, inviterFullName, invitedRole, expiresAtUtc, acceptUrl);

        return Task.CompletedTask;
    }

    public Task SendMeetingInviteAsync(
        IReadOnlyList<string> toEmails,
        string organiserFullName,
        string organiserEmail,
        string subject,
        string bodyMd,
        string icsBody,
        CancellationToken ct = default)
    {
        // Dev stub. The console log carries enough that a developer can
        // copy the .ics into a file and double-click it to verify
        // calendar-client compatibility without needing a real SMTP path.
        logger.LogInformation(
            "[meeting-invite] to={To} organiser=\"{Organiser}\" subject=\"{Subject}\"\n{Ics}",
            string.Join(",", toEmails), organiserFullName, subject, icsBody);
        return Task.CompletedTask;
    }
}
