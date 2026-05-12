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

public class RefreshTokenCommandHandler(
    IAppDbContext db,
    IJwtService jwt)
    : IRequestHandler<RefreshTokenCommand, Result<AuthResponse>>
{
    public async Task<Result<AuthResponse>> Handle(RefreshTokenCommand request, CancellationToken ct)
    {
        var incomingHash = jwt.HashRefreshToken(request.RefreshToken);

        var stored = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == incomingHash, ct);

        if (stored is null || !stored.IsActive)
            return Result.Failure<AuthResponse>(AuthErrors.InvalidRefreshToken);

        var (newPlain, newHash, newExpiresAt) = jwt.GenerateRefreshToken();
        var replacement = new RefreshToken
        {
            UserId = stored.UserId,
            TokenHash = newHash,
            ExpiresAt = newExpiresAt
        };
        db.RefreshTokens.Add(replacement);

        stored.RevokedAt = DateTime.UtcNow;
        stored.ReplacedByTokenId = replacement.Id;

        var accessToken = jwt.GenerateAccessToken(stored.User);

        await db.SaveChangesAsync(ct);

        return Result.Success(new AuthResponse(
            stored.User.Id,
            stored.User.Email,
            stored.User.FullName,
            accessToken,
            newPlain,
            DateTime.UtcNow.AddMinutes(15),
            newExpiresAt));
    }
}
