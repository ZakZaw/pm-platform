using System.Threading.RateLimiting;
using Api.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Middleware;

/// <summary>
/// H4 - strict per-route policies on top of the global
/// <see cref="ApiRateLimitMiddleware"/> budget:
/// <list type="bullet">
/// <item><see cref="Auth"/> - /auth/* per client IP (credential stuffing,
/// sign-up spam). Per-account lockout lives in the login handler.</item>
/// <item><see cref="PublicLink"/> - share links, guest meeting links and
/// invitation tokens per client IP (token/password guessing).</item>
/// <item><see cref="AIQuotaAttribute.PolicyName"/> - AI endpoints per
/// caller (burst control; the daily cap is <see cref="AIQuotaAttribute"/>).</item>
/// </list>
/// The built-in limiter evicts idle partitions, so memory stays bounded.
/// Limits are configurable under RateLimit:Auth / RateLimit:PublicLink /
/// RateLimit:AI (PermitLimit per WindowSeconds).
/// </summary>
public static class RateLimitPolicies
{
    public const string Auth = "auth";
    public const string PublicLink = "public-link";

    public static IServiceCollection AddPlatformRateLimiting(this IServiceCollection services, IConfiguration config)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (ctx, ct) =>
            {
                if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    ctx.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                ctx.HttpContext.Response.ContentType = "application/problem+json";
                await ctx.HttpContext.Response.WriteAsync(
                    "{\"title\":\"Too Many Requests\",\"status\":429,\"detail\":\"Too many requests. Slow down and retry shortly.\"}", ct);
            };

            options.AddPolicy(Auth, http => FixedWindow(
                "auth:" + RateLimitPartition.ByIp(http.Connection.RemoteIpAddress), config, "Auth", 20, 60));

            options.AddPolicy(PublicLink, http => FixedWindow(
                "link:" + RateLimitPartition.ByIp(http.Connection.RemoteIpAddress), config, "PublicLink", 30, 60));

            options.AddPolicy(AIQuotaAttribute.PolicyName, http => FixedWindow(
                "ai:" + RateLimitPartition.Resolve(http.User, http.Connection.RemoteIpAddress), config, "AI", 20, 60));
        });
        return services;
    }

    private static RateLimitPartition<string> FixedWindow(
        string key, IConfiguration config, string section, int defaultLimit, int defaultWindowSeconds) =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = config.GetValue<int?>($"RateLimit:{section}:PermitLimit") ?? defaultLimit,
            Window = TimeSpan.FromSeconds(config.GetValue<int?>($"RateLimit:{section}:WindowSeconds") ?? defaultWindowSeconds),
            QueueLimit = 0,
            AutoReplenishment = true,
        });
}