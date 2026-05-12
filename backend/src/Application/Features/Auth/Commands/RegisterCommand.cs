using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Auth.Commands;

public record RegisterCommand(string Email, string Password, string FullName) : IRequest<Result<AuthResponse>>;

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(120);
    }
}

public class RegisterCommandHandler(
    IAppDbContext db,
    IPasswordHasher hasher,
    IJwtService jwt)
    : IRequestHandler<RegisterCommand, Result<AuthResponse>>
{
    public async Task<Result<AuthResponse>> Handle(RegisterCommand request, CancellationToken ct)
    {
        var normalized = request.Email.Trim().ToLowerInvariant();

        var exists = await db.Users.AnyAsync(u => u.Email == normalized, ct);
        if (exists) return Result.Failure<AuthResponse>(AuthErrors.EmailAlreadyRegistered);

        var user = new User
        {
            Email = normalized,
            PasswordHash = hasher.Hash(request.Password),
            FullName = request.FullName.Trim()
        };
        db.Users.Add(user);

        var accessToken = jwt.GenerateAccessToken(user);
        var (plainRefresh, refreshHash, refreshExpiresAt) = jwt.GenerateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refreshHash,
            ExpiresAt = refreshExpiresAt
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new AuthResponse(
            user.Id,
            user.Email,
            user.FullName,
            accessToken,
            plainRefresh,
            DateTime.UtcNow.AddMinutes(15),
            refreshExpiresAt));
    }
}
