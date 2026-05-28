namespace Infrastructure.ExternalAdapters.GitHub;

/// <summary>
/// F2-23 settings bound from the <c>GitHub</c> config section. The OAuth
/// client id + secret come from the GitHub OAuth App; the .env exposes
/// them as GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET, bridged in Program.cs.
/// <see cref="CallbackBaseUrl"/> is the public base URL of THIS API —
/// it forms both the OAuth redirect_uri and the webhook payload URL, so
/// it must match what the GitHub OAuth App is registered with.
/// </summary>
public class GitHubSettings
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }

    /// <summary>Public base URL of this API, e.g. https://api.myapp.com.
    /// Falls back to localhost for dev.</summary>
    public string CallbackBaseUrl { get; set; } = "http://localhost:5080";

    /// <summary>OAuth scope requested. <c>repo</c> covers private repos +
    /// hook admin; <c>read:user</c> lets us name the connection.</summary>
    public string Scope { get; set; } = "repo read:user";
}
