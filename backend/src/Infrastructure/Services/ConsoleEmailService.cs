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
}
