using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Auth.Commands;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponse>>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginCommandHandler(
    IAppDbContext db,
    IPasswordHasher hasher,
    IJwtService jwt,
    ILoginAttemptStore attempts)
    : IRequestHandler<LoginCommand, Result<AuthResponse>>
{
    private static string? _dummyHash;

    /// <summary>A real hash of a random secret, computed once per process.</summary>
    private string DummyHash() => _dummyHash ??= hasher.Hash(Guid.NewGuid().ToString("N"));

    public async Task<Result<AuthResponse>> Handle(LoginCommand request, CancellationToken ct)
    {
        var normalized = request.Email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;

        // H4 - per-account lockout after repeated failures. Checked before
        // the password so a locked account can't be used as an oracle.
        if (LoginLockoutPolicy.IsLocked(attempts.Get(normalized), now))
            return Result.Failure<AuthResponse>(AuthErrors.AccountLocked);

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalized, ct);

        // L7 - always run one password verification, against a dummy hash
        // when the account doesn't exist, so response time doesn't reveal
        // which emails are registered.
        var passwordOk = hasher.Verify(user?.PasswordHash ?? DummyHash(), request.Password);
        if (user is null || !passwordOk)
        {
            attempts.Set(normalized, LoginLockoutPolicy.RecordFailure(attempts.Get(normalized), now));
            return Result.Failure<AuthResponse>(AuthErrors.InvalidCredentials);
        }
        attempts.Clear(normalized);

        var accessToken = jwt.GenerateAccessToken(user);
        var (plainRefresh, refreshHash, refreshExpiresAt) = jwt.GenerateRefreshToken();
        db.RefreshTokens.Add(RefreshToken.StartFamily(user.Id, refreshHash, refreshExpiresAt));

        await db.SaveChangesAsync(ct);

        return Result.Success(new AuthResponse(
            user.Id,
            user.Email,
            user.FullName,
            user.AvatarUrl,
            accessToken,
            plainRefresh,
            DateTime.UtcNow.AddMinutes(15),
            refreshExpiresAt));
    }
}
