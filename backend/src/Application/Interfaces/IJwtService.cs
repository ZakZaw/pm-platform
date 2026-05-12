using Domain.Entities;

namespace Application.Interfaces;

public interface IJwtService
{
    string GenerateAccessToken(User user);

    (string PlainToken, string TokenHash, DateTime ExpiresAt) GenerateRefreshToken();

    string HashRefreshToken(string plainToken);
}
