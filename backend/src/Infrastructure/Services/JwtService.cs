using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Services;

public class JwtSettings
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 30;
}

public class JwtService : IJwtService
{
    private readonly JwtSettings _settings;
    private readonly SigningCredentials _credentials;

    public JwtService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SigningKey));
        _credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    }

    public string GenerateAccessToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("name", user.FullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenMinutes),
            signingCredentials: _credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public (string PlainToken, string TokenHash, DateTime ExpiresAt) GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        var plain = Convert.ToBase64String(bytes);
        var hash = HashRefreshToken(plain);
        var expiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenDays);
        return (plain, hash, expiresAt);
    }

    public string HashRefreshToken(string plainToken)
    {
        var bytes = Encoding.UTF8.GetBytes(plainToken);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
