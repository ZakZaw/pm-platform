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
}
