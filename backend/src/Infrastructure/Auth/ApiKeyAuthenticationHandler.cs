using System.Security.Claims;
using System.Text.Encodings.Web;
using Application.Features.ApiKeys;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Auth;

/// <summary>
/// F2-24 — authenticates requests bearing an <c>X-Api-Key</c> header as
/// an alternative to a user JWT. The key resolves to the org + creating
/// user; we issue a principal whose NameIdentifier is that user, so the
/// existing membership-based authorization works unchanged. Returns
/// NoResult (not Fail) when the header is absent, so the JWT scheme can
/// still handle normal browser traffic.
/// </summary>
public class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AppDbContext db)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-Api-Key";
    public const string OrgIdClaim = "org_id";
    public const string AuthMethodClaim = "auth_method";
    public const string AuthMethodApiKey = "api_key";

    /// <summary>
    /// The org an API-key principal is confined to, or null for a normal
    /// user (JWT) principal. Only principals issued by this handler carry
    /// the claim pair, so a JWT can't smuggle one in.
    /// </summary>
    public static Guid? GetApiKeyOrgId(ClaimsPrincipal? user)
    {
        // When a request carries both a JWT and an API key the merged
        // principal holds both identities; treat it as the (narrower)
        // API-key principal.
        var identity = user?.Identities.FirstOrDefault(i =>
            i.IsAuthenticated && i.AuthenticationType == SchemeName);
        if (identity is null || identity.FindFirst(AuthMethodClaim)?.Value != AuthMethodApiKey)
            return null;
        return Guid.TryParse(identity.FindFirst(OrgIdClaim)?.Value, out var orgId) ? orgId : null;
    }

    public static bool IsApiKeyPrincipal(ClaimsPrincipal? user) => GetApiKeyOrgId(user) is not null;

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var values))
            return AuthenticateResult.NoResult();

        var raw = values.ToString().Trim();
        if (string.IsNullOrEmpty(raw))
            return AuthenticateResult.NoResult();

        var hash = ApiKeyGenerator.Hash(raw);
        var key = await db.ApiKeys.FirstOrDefaultAsync(k => k.KeyHash == hash);
        if (key is null)
            return AuthenticateResult.Fail("Invalid API key.");

        var now = DateTime.UtcNow;
        if (!key.IsActive(now))
            return AuthenticateResult.Fail("API key is revoked or expired.");

        // H2 - a key acts as its creator; once the creator has left the org
        // the key must stop working too.
        var creatorActive = await db.OrgMemberships.AnyAsync(m =>
            m.OrganizationId == key.OrganizationId
            && m.UserId == key.CreatedByUserId
            && m.RemovedAt == null);
        if (!creatorActive)
            return AuthenticateResult.Fail("API key owner is no longer a member of the organization.");

        // Throttle the last-used write to at most once a minute so a busy
        // key doesn't generate a DB write per request.
        if (key.LastUsedAt is null || key.LastUsedAt < now.AddMinutes(-1))
        {
            key.LastUsedAt = now;
            await db.SaveChangesAsync();
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, key.CreatedByUserId.ToString()),
            new Claim(OrgIdClaim, key.OrganizationId.ToString()),
            new Claim(AuthMethodClaim, AuthMethodApiKey),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);
        return AuthenticateResult.Success(ticket);
    }
}
