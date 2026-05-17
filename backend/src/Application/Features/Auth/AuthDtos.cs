namespace Application.Features.Auth;

public record AuthResponse(
    Guid UserId,
    string Email,
    string FullName,
    string? AvatarUrl,
    string AccessToken,
    string RefreshToken,
    DateTime AccessTokenExpiresAt,
    DateTime RefreshTokenExpiresAt);
