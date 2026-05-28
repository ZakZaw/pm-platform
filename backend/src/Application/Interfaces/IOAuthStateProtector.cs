namespace Application.Interfaces;

/// <summary>
/// F2-23 — carries the connect context (which project / repo / user
/// kicked off the flow) across the GitHub OAuth round-trip. The state
/// is HMAC-signed so the unauthenticated callback can trust it without
/// a server-side session table. Encoded values expire quickly.
/// </summary>
public record OAuthState(Guid ProjectId, string Repo, Guid UserId, string ReturnPath);

public interface IOAuthStateProtector
{
    /// <summary>Sign + encode the state into an opaque, URL-safe token.</summary>
    string Protect(OAuthState state);

    /// <summary>Verify + decode. Returns null when the token is missing,
    /// malformed, tampered with, or older than the allowed window.</summary>
    OAuthState? Unprotect(string? token);
}
