using System.Text;
using Npgsql;

namespace Api.Configuration;

/// <summary>
/// M2 - turns the flat .env / container variables into the config keys the
/// app binds, and refuses to boot outside Development with a weak or
/// publicly known JWT signing key.
/// </summary>
public static class SecretsConfiguration
{
    /// <summary>The key committed in appsettings.Development.json; public, so never valid in production.</summary>
    public const string CommittedDevSigningKey =
        "dev-only-signing-key-replace-in-production-please-at-least-32-chars-long";

    /// <summary>The placeholder committed in .env.example; equally public.</summary>
    public const string EnvExamplePlaceholder =
        "replace_with_any_long_random_string_at_least_64_chars_long";

    /// <summary>HS256 needs a key of at least 256 bits.</summary>
    public const int MinimumKeyBytes = 32;

    /// <summary>
    /// JWT_SECRET → Jwt:SigningKey and DATABASE_URL → ConnectionStrings:DefaultConnection.
    /// In Development a too-short JWT_SECRET is ignored (the
    /// appsettings.Development.json key keeps local dev working); anywhere
    /// else it is applied and then rejected by <see cref="ValidateSigningKey"/>.
    /// </summary>
    public static void BridgeEnvironment(IConfiguration config, bool isDevelopment, Func<string, string?> getEnv)
    {
        var jwtSecret = getEnv("JWT_SECRET");
        if (!string.IsNullOrWhiteSpace(jwtSecret)
            && (!isDevelopment || Encoding.UTF8.GetByteCount(jwtSecret) >= MinimumKeyBytes))
        {
            config["Jwt:SigningKey"] = jwtSecret;
        }

        var databaseUrl = getEnv("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(databaseUrl))
        {
            config["ConnectionStrings:DefaultConnection"] = ToNpgsqlConnectionString(databaseUrl);
        }
    }

    /// <summary>
    /// Fails fast when the signing key is unusable. Outside Development the
    /// key must exist, be at least 32 bytes and not be one of the keys
    /// committed to the repository.
    /// </summary>
    public static string ValidateSigningKey(string? key, bool isDevelopment)
    {
        if (string.IsNullOrWhiteSpace(key))
            throw new InvalidOperationException(
                "Jwt:SigningKey is not configured. Set JWT_SECRET to a random value of at least 32 bytes.");

        if (isDevelopment) return key;

        if (Encoding.UTF8.GetByteCount(key) < MinimumKeyBytes)
            throw new InvalidOperationException(
                $"Jwt:SigningKey must be at least {MinimumKeyBytes} bytes outside Development. Set JWT_SECRET to a longer random value.");

        if (key == CommittedDevSigningKey || key == EnvExamplePlaceholder)
            throw new InvalidOperationException(
                "Jwt:SigningKey is the public development/example key. Set JWT_SECRET to a private random value.");

        return key;
    }

    /// <summary>
    /// Accepts either an Npgsql key/value string ("Host=...;Database=...")
    /// or a URL ("postgres://user:pass@host:5432/db?sslmode=require").
    /// </summary>
    public static string ToNpgsqlConnectionString(string databaseUrl)
    {
        var value = databaseUrl.Trim();
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
            return value;

        var uri = new Uri(value);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort || uri.Port <= 0 ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
        };
        if (userInfo.Length > 1)
            builder.Password = Uri.UnescapeDataString(userInfo[1]);

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var kv = pair.Split('=', 2);
            if (kv.Length == 2 && kv[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(Uri.UnescapeDataString(kv[1]), ignoreCase: true, out var mode))
                builder.SslMode = mode;
        }

        return builder.ConnectionString;
    }
}
