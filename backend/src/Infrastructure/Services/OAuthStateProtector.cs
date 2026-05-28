using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Interfaces;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

/// <summary>
/// F2-23 — HMAC-signed, stateless OAuth state. Format is
/// <c>base64url(payload).base64url(sig)</c> where the payload is the
/// JSON-serialised <see cref="OAuthState"/> plus an issued-at stamp,
/// and the signature is HMAC-SHA256 over the payload using the JWT
/// signing key. Tokens older than <see cref="TokenLifetime"/> are
/// rejected so a leaked state can't be replayed indefinitely.
/// </summary>
public class OAuthStateProtector(IOptions<JwtSettings> jwtOptions) : IOAuthStateProtector
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(15);
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private readonly byte[] _key = Encoding.UTF8.GetBytes(jwtOptions.Value.SigningKey);

    private record Payload(Guid ProjectId, string Repo, Guid UserId, string ReturnPath, long IssuedAtUnix);

    public string Protect(OAuthState state)
    {
        var payload = new Payload(
            state.ProjectId, state.Repo, state.UserId, state.ReturnPath,
            DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var json = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOpts);
        var sig = Sign(json);
        return $"{Base64Url.Encode(json)}.{Base64Url.Encode(sig)}";
    }

    public OAuthState? Unprotect(string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var parts = token.Split('.');
        if (parts.Length != 2) return null;

        byte[] json, sig;
        try
        {
            json = Base64Url.Decode(parts[0]);
            sig = Base64Url.Decode(parts[1]);
        }
        catch (FormatException)
        {
            return null;
        }

        var expected = Sign(json);
        if (!CryptographicOperations.FixedTimeEquals(sig, expected)) return null;

        Payload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<Payload>(json, JsonOpts);
        }
        catch (JsonException)
        {
            return null;
        }
        if (payload is null) return null;

        var issuedAt = DateTimeOffset.FromUnixTimeSeconds(payload.IssuedAtUnix);
        if (DateTimeOffset.UtcNow - issuedAt > TokenLifetime) return null;

        return new OAuthState(payload.ProjectId, payload.Repo, payload.UserId, payload.ReturnPath ?? "/");
    }

    private byte[] Sign(byte[] data)
    {
        using var hmac = new HMACSHA256(_key);
        return hmac.ComputeHash(data);
    }

    private static class Base64Url
    {
        public static string Encode(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        public static byte[] Decode(string s)
        {
            var padded = s.Replace('-', '+').Replace('_', '/');
            padded = (padded.Length % 4) switch
            {
                2 => padded + "==",
                3 => padded + "=",
                0 => padded,
                _ => throw new FormatException("Invalid base64url length."),
            };
            return Convert.FromBase64String(padded);
        }
    }
}
