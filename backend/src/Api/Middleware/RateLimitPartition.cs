using System.Net;
using System.Security.Claims;
using Infrastructure.Auth;

namespace Api.Middleware;

/// <summary>
/// H4 - who a request is counted against. Only an *authenticated*
/// identity earns its own bucket: a verified API key ("key:{id}"), else a
/// signed-in user ("user:{id}"), else the client IP. An unverified
/// X-Api-Key header is ignored, so inventing random keys no longer buys a
/// fresh bucket per request.
/// </summary>
public static class RateLimitPartition
{
    public static string Resolve(ClaimsPrincipal? user, IPAddress? remoteIp)
    {
        var keyIdentity = user?.Identities.FirstOrDefault(i =>
            i.IsAuthenticated && i.AuthenticationType == ApiKeyAuthenticationHandler.SchemeName);
        var keyId = keyIdentity?.FindFirst(ApiKeyAuthenticationHandler.ApiKeyIdClaim)?.Value;
        if (!string.IsNullOrEmpty(keyId))
            return "key:" + keyId;

        var userIdentity = user?.Identities.FirstOrDefault(i => i.IsAuthenticated);
        var sub = userIdentity?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? userIdentity?.FindFirst("sub")?.Value;
        if (Guid.TryParse(sub, out var userId))
            return "user:" + userId.ToString("D");

        return ByIp(remoteIp);
    }

    public static string ByIp(IPAddress? remoteIp) =>
        "ip:" + (remoteIp?.ToString() ?? "unknown");
}