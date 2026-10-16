using Application.Common;
using Application.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Auth.Commands;

/// <summary>
/// M5 - server-side sign-out: revokes the presented refresh token's whole
/// family, so neither it nor any successor can mint new access tokens.
/// Always succeeds (unknown or already-revoked tokens are a no-op) so the
/// endpoint can't be used to probe tokens. Access tokens already issued
/// stay valid until they expire (15 minutes).
/// </summary>
public record LogoutCommand(string RefreshToken) : IRequest<Result>;

public class LogoutCommandValidator : AbstractValidator<LogoutCommand>
{
    public LogoutCommandValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(512);
    }
}

public class LogoutCommandHandler(IAppDbContext db, IJwtService jwt)
    : IRequestHandler<LogoutCommand, Result>
{
    public async Task<Result> Handle(LogoutCommand request, CancellationToken ct)
    {
        var hash = jwt.HashRefreshToken(request.RefreshToken);
        var familyId = await db.RefreshTokens
            .Where(t => t.TokenHash == hash)
            .Select(t => (Guid?)t.FamilyId)
            .FirstOrDefaultAsync(ct);

        if (familyId is { } id)
            await RefreshTokenCommandHandler.RevokeFamilyAsync(db, id, DateTime.UtcNow, ct);

        return Result.Success();
    }
}

/// <summary>M5 - "sign out everywhere": revokes every refresh token of the caller.</summary>
public record LogoutAllCommand : IRequest<Result>;

public class LogoutAllCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<LogoutAllCommand, Result>
{
    public async Task<Result> Handle(LogoutAllCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var now = DateTime.UtcNow;
        await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
        return Result.Success();
    }
}