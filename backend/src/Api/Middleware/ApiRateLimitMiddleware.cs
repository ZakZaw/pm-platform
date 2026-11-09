using System.Collections.Concurrent;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Authentication;

namespace Api.Middleware;

/// <summary>
/// F2-24 - fixed-window rate limiting for the public API, emitting the
/// <c>X-RateLimit-*</c> headers the AC asks for. In-memory and
/// per-instance - fine for a single-node deployment; a multi-node deploy
/// would back this with a shared store.
///
/// H4: runs after authentication and partitions by the *verified*
/// identity (<see cref="RateLimitPartition"/>), so a made-up X-Api-Key no
/// longer gets its own bucket. The counter table is swept of expired
/// windows so memory stays bounded. Stricter per-route policies (auth,
/// public links, AI) are layered on top with ASP.NET rate limiting.
///
/// Limits are configurable via the <c>RateLimit</c> config section
/// (PermitLimit, WindowSeconds). Only <c>/api/</c> traffic is limited so
/// Swagger, health, and SignalR are untouched.
/// </summary>
public class ApiRateLimitMiddleware
{
    private const int SweepThreshold = 10_000;

    private readonly RequestDelegate _next;
    private readonly int _limit;
    private readonly int _windowSeconds;

    private sealed class Counter
    {
        public long WindowStart;
        public int Count;
    }

    private static readonly ConcurrentDictionary<string, Counter> Counters = new();
    private static long _lastSweptWindow;

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

        var user = context.User;
        if (user.Identity?.IsAuthenticated != true
            && context.Request.Headers.ContainsKey(ApiKeyAuthenticationHandler.HeaderName))
        {
            // The API-key scheme isn't the default, so authenticate it here.
            // The handler caches its result for the rest of the request.
            var keyAuth = await context.AuthenticateAsync(ApiKeyAuthenticationHandler.SchemeName);
            if (keyAuth.Succeeded) user = keyAuth.Principal!;
        }

        var partition = RateLimitPartition.Resolve(user, context.Connection.RemoteIpAddress);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var windowStart = now - (now % _windowSeconds);
        var resetAt = windowStart + _windowSeconds;

        SweepExpired(windowStart);

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

    /// <summary>
    /// Drops counters from earlier windows once the table grows large, at
    /// most once per window, so random partitions can't grow it forever.
    /// </summary>
    private static void SweepExpired(long currentWindow)
    {
        if (Counters.Count < SweepThreshold) return;
        var last = Interlocked.Read(ref _lastSweptWindow);
        if (last == currentWindow || Interlocked.CompareExchange(ref _lastSweptWindow, currentWindow, last) != last)
            return;

        foreach (var (key, counter) in Counters)
        {
            if (Volatile.Read(ref counter.WindowStart) < currentWindow)
                Counters.TryRemove(key, out _);
        }
    }
}