using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Auth.Commands;

public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<AuthResponse>>;

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty();
    }
}

/// <summary>
/// Rotates a refresh token. M3:
/// <list type="bullet">
/// <item>Reuse detection - presenting a token that was already rotated
/// revokes its whole family (the legitimate client and the thief both
/// have to sign in again).</item>
/// <item>No forking - the old token is claimed with a conditional update
/// (<c>RevokedAt IS NULL</c>), so two parallel refreshes can't both mint
/// a successor; the loser gets 401.</item>
/// </list>
/// </summary>
public class RefreshTokenCommandHandler(
    IAppDbContext db,
    IJwtService jwt)
    : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var incomingHash = jwt.HashRefreshToken(request.RefreshToken);
        var now = DateTime.UtcNow;

        var stored = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == incomingHash, ct);

        switch (RefreshTokenPolicy.Classify(stored, now))
        {
            case RefreshTokenState.Reused:
                await RevokeFamilyAsync(db, stored!.FamilyId, now, ct);
                return Result.Failure<AuthResponse>(AuthErrors.InvalidRefreshToken);
            case RefreshTokenState.Unknown:
            case RefreshTokenState.Inactive:
                return Result.Failure<AuthResponse>(AuthErrors.InvalidRefreshToken);
        }

        var (newPlain, newHash, newExpiresAt) = jwt.GenerateRefreshToken();
        var replacement = new RefreshToken
        {
            UserId = stored!.UserId,
            TokenHash = newHash,
            ExpiresAt = newExpiresAt,
            FamilyId = stored.FamilyId,
        };

        // Claim the presented token atomically; only one caller can win.
        var claimed = await db.RefreshTokens
            .Where(t => t.Id == stored.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.RevokedAt, now)
                .SetProperty(t => t.ReplacedByTokenId, replacement.Id), ct);
        if (claimed == 0)
            return Result.Failure<AuthResponse>(AuthErrors.InvalidRefreshToken);

        db.RefreshTokens.Add(replacement);
        var accessToken = jwt.GenerateAccessToken(stored.User);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AuthResponse(
            stored.User.Id,
            stored.User.Email,
            stored.User.FullName,
            stored.User.AvatarUrl,
            accessToken,
            newPlain,
            DateTime.UtcNow.AddMinutes(15),
            newExpiresAt));
    }

    internal static Task<int> RevokeFamilyAsync(IAppDbContext db, Guid familyId, DateTime now, CancellationToken ct) =>
        db.RefreshTokens
            .Where(t => t.FamilyId == familyId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
}