using System.Security.Cryptography;
using System.Text;

namespace Application.Features.ApiKeys;

/// <summary>
/// F2-24 — mints and hashes public API keys. The raw secret is
/// <c>pmk_</c> + 43 url-safe base64 chars (256 bits of entropy); only
/// its SHA-256 hash is persisted, with a short non-secret prefix kept
/// for display. The same <see cref="Hash"/> runs on the auth path to
/// look an incoming key up by hash.
/// </summary>
public static class ApiKeyGenerator
{
    public const string KeyPrefix = "pmk_";
    private const int PrefixDisplayLength = 12; // "pmk_" + 8 chars

    public record GeneratedKey(string Secret, string Prefix, string Hash);

    public static GeneratedKey Generate()
    {
        var random = RandomNumberGenerator.GetBytes(32);
        var body = Convert.ToBase64String(random)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var secret = KeyPrefix + body;
        var prefix = secret[..Math.Min(PrefixDisplayLength, secret.Length)];
        return new GeneratedKey(secret, prefix, Hash(secret));
    }

    public static string Hash(string secret)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
