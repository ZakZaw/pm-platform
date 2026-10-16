using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Infrastructure.Services.Video;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Unit.Security;

/// <summary>
/// M7 - mirrors how LiveKit signs webhooks: an HS256 JWT issued by the API
/// key whose `sha256` claim is base64(SHA-256(raw body)).
/// </summary>
public class LiveKitWebhookTests
{
    private const string ApiKey = "APIdevkey";
    private const string ApiSecret = "a-livekit-api-secret-that-is-long-enough-1234";
    private const string Body = "{\"event\":\"room_finished\",\"room\":{\"name\":\"m-1\"}}";

    private static LiveKitVideoService Service() => new(
        Options.Create(new VideoSettings { Url = "wss://example.livekit.cloud", ApiKey = ApiKey, ApiSecret = ApiSecret }),
        NullLogger<LiveKitVideoService>.Instance,
        new NoHttp());

    private static string Sha256B64(string s) => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(s)));

    private static string Token(string? sha256, string secret = ApiSecret)
    {
        var claims = new List<Claim>();
        if (sha256 is not null) claims.Add(new Claim("sha256", sha256));
        var token = new JwtSecurityToken(
            issuer: ApiKey,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Fact]
    public void GenuineWebhook_Verifies() =>
        Service().VerifyWebhookSignature(Token(Sha256B64(Body)), Body);

    [Fact]
    public void TamperedBody_IsRejected() =>
        Assert.Throws<UnauthorizedAccessException>(() =>
            Service().VerifyWebhookSignature(Token(Sha256B64(Body)), Body.Replace("m-1", "m-2")));

    [Fact]
    public void MissingSha256Claim_IsRejected() =>
        Assert.Throws<UnauthorizedAccessException>(() => Service().VerifyWebhookSignature(Token(null), Body));

    [Fact]
    public void HexDigest_IsNotAccepted()
    {
        var hex = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Body))).ToLowerInvariant();
        Assert.False(LiveKitVideoService.BodyMatchesSha256Claim(hex, Body));
    }

    [Fact]
    public void WrongSecret_FailsSignatureValidation() =>
        Assert.ThrowsAny<SecurityTokenException>(() =>
            Service().VerifyWebhookSignature(Token(Sha256B64(Body), "some-other-secret-that-is-also-long-enough!"), Body));

    private sealed class NoHttp : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => throw new InvalidOperationException("No HTTP in unit tests.");
    }
}