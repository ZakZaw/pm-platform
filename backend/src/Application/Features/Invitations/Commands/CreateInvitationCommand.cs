using System.Net.Mail;
using System.Security.Cryptography;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Invitations.Commands;

public record CreateInvitationCommand(string Slug, string Email, OrgRole Role)
    : IRequest<Result<InvitationDto>>;

// Inviter authorisation (Admin+) is enforced by [RequireOrgRole] on the
// controller. The handler validates business rules (email format, role,
// duplicate membership / invitation) and persists the invitation.
public class CreateInvitationCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IEmailService emailService)
    : IRequestHandler<CreateInvitationCommand, Result<InvitationDto>>
{
    private static readonly TimeSpan InviteTtl = TimeSpan.FromDays(7);

    public async Task<Result<InvitationDto>> Handle(CreateInvitationCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<InvitationDto>(AuthErrors.NotAuthenticated);

        var normalisedEmail = NormaliseEmail(request.Email);
        if (normalisedEmail is null)
            return Result.Failure<InvitationDto>(InvitationErrors.InvalidEmail);

        if (request.Role is not (OrgRole.Admin or OrgRole.Member or OrgRole.Guest))
            return Result.Failure<InvitationDto>(InvitationErrors.InvalidRole);

        var org = await db.Organizations.FirstOrDefaultAsync(o => o.Slug == request.Slug, ct);
        if (org is null)
            return Result.Failure<InvitationDto>(OrgErrors.NotFound);

        var alreadyMember = await db.OrgMemberships
            .AnyAsync(m => m.OrganizationId == org.Id && m.User.Email == normalisedEmail, ct);
        if (alreadyMember)
            return Result.Failure<InvitationDto>(InvitationErrors.AlreadyMember);

        var now = DateTime.UtcNow;
        var duplicate = await db.Invitations
            .AnyAsync(i => i.OrganizationId == org.Id
                        && i.Email == normalisedEmail
                        && i.AcceptedAt == null
                        && i.ExpiresAt > now, ct);
        if (duplicate)
            return Result.Failure<InvitationDto>(InvitationErrors.DuplicateActive);

        var inviter = await db.Users.FirstAsync(u => u.Id == userId, ct);

        var invitation = new Invitation
        {
            OrganizationId = org.Id,
            Email = normalisedEmail,
            Role = request.Role,
            Token = GenerateToken(),
            ExpiresAt = now.Add(InviteTtl),
            CreatedAt = now,
            CreatedById = userId
        };
        db.Invitations.Add(invitation);
        await db.SaveChangesAsync(ct);

        // Best-effort: a failed email send shouldn't roll back the invitation
        // (the inviter can resend by recreating). For now this is a console
        // log, so it cannot fail; the try/catch guards the future real
        // provider.
        try
        {
            await emailService.SendInvitationAsync(
                toEmail: invitation.Email,
                organizationName: org.Name,
                inviterFullName: inviter.FullName,
                invitedRole: invitation.Role.ToString(),
                invitationToken: invitation.Token,
                expiresAtUtc: invitation.ExpiresAt,
                ct: ct);
        }
        catch { /* swallow; invitation is persisted */ }

        return Result.Success(new InvitationDto(
            invitation.Id,
            invitation.Email,
            invitation.Role.ToString(),
            invitation.ExpiresAt,
            invitation.CreatedAt));
    }

    private static string? NormaliseEmail(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim().ToLowerInvariant();
        try { _ = new MailAddress(trimmed); }
        catch { return null; }
        return trimmed.Length > 254 ? null : trimmed;
    }

    private static string GenerateToken()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        // base64url: '+' -> '-', '/' -> '_', strip '='
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }
}
