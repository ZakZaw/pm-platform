namespace Api.Middleware;

/// <summary>
/// L2 - baseline security headers on every response. The API only serves
/// JSON (and attachment downloads), so the CSP is maximally strict: nothing
/// may load, nothing may frame it. Endpoints that need something different
/// (attachment downloads, public uploads) overwrite the CSP themselves.
/// Swagger UI (Development only) is exempt from the CSP so it can run.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public const string ApiContentSecurityPolicy =
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    public Task Invoke(HttpContext context)
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Cross-Origin-Opener-Policy"] = "same-origin";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        if (!context.Request.Path.StartsWithSegments("/swagger"))
            headers["Content-Security-Policy"] = ApiContentSecurityPolicy;
        return next(context);
    }
}