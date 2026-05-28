using System.Collections.Concurrent;
using Application.Features.ApiKeys;
using Infrastructure.Auth;

namespace Api.Middleware;

/// <summary>
/// F2-24 — fixed-window rate limiting for the public API, partitioned by
/// API key when present (else by client IP), and emitting the
/// <c>X-RateLimit-*</c> headers the AC asks for. In-memory and
/// per-instance — fine for a single-node dev/demo deployment; a
/// multi-node deploy would back this with a shared store.
///
/// Limits are configurable via the <c>RateLimit</c> config section
/// (PermitLimit, WindowSeconds). Only <c>/api/</c> traffic is limited so
/// Swagger, health, and SignalR are untouched.
/// </summary>
public class ApiRateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly int _limit;
    private readonly int _windowSeconds;

    private sealed class Counter
    {
        public long WindowStart;
        public int Count;
    }

    private static readonly ConcurrentDictionary<string, Counter> Counters = new();

    public ApiRateLimitMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _limit = config.GetValue<int?>("RateLimit:PermitLimit") ?? 300;
        _windowSeconds = config.GetValue<int?>("RateLimit:WindowSeconds") ?? 60;
    }

    public async Task Invoke(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await _next(context);
            return;
        }

        var partition = ResolvePartition(context);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var windowStart = now - (now % _windowSeconds);
        var resetAt = windowStart + _windowSeconds;

        var counter = Counters.GetOrAdd(partition, _ => new Counter { WindowStart = windowStart });
        int count;
        lock (counter)
        {
            if (counter.WindowStart != windowStart)
            {
                counter.WindowStart = windowStart;
                counter.Count = 0;
            }
            counter.Count++;
            count = counter.Count;
        }

        var remaining = Math.Max(0, _limit - count);
        var headers = context.Response.Headers;
        headers["X-RateLimit-Limit"] = _limit.ToString();
        headers["X-RateLimit-Remaining"] = remaining.ToString();
        headers["X-RateLimit-Reset"] = resetAt.ToString();

        if (count > _limit)
        {
            var retryAfter = Math.Max(1, resetAt - now);
            headers["Retry-After"] = retryAfter.ToString();
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsync(
                $"{{\"title\":\"Too Many Requests\",\"status\":429," +
                $"\"detail\":\"Rate limit exceeded. Retry in {retryAfter}s.\"}}");
            return;
        }

        await _next(context);
    }

    private static string ResolvePartition(HttpContext context)
    {
        // Prefer the API key (hashed so we don't key the dictionary on a
        // secret); otherwise fall back to the client IP.
        if (context.Request.Headers.TryGetValue(ApiKeyAuthenticationHandler.HeaderName, out var key)
            && !string.IsNullOrWhiteSpace(key))
        {
            return "key:" + ApiKeyGenerator.Hash(key.ToString().Trim());
        }
        return "ip:" + (context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
    }
}
