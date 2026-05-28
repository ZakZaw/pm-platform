using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.ExternalAdapters.GitHub;

/// <summary>
/// F2-23 — <see cref="IGitHubService"/> over the GitHub REST + OAuth
/// HTTP APIs. No SDK: the surface we need (token exchange, hook
/// CRUD, HMAC verify) is a handful of calls. Network failures on the
/// best-effort paths (webhook register/delete) are logged and
/// swallowed so connecting a repo never hard-fails on a transient
/// GitHub hiccup or an unreachable dev callback URL.
/// </summary>
public class GitHubAdapter(
    IOptions<GitHubSettings> options,
    IHttpClientFactory httpClientFactory,
    ILogger<GitHubAdapter> logger) : IGitHubService
{
    private readonly GitHubSettings _settings = options.Value;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private const string OAuthAuthorizeUrl = "https://github.com/login/oauth/authorize";
    private const string OAuthTokenUrl = "https://github.com/login/oauth/access_token";
    private const string ApiBaseUrl = "https://api.github.com";

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.ClientId)
        && !string.IsNullOrWhiteSpace(_settings.ClientSecret);

    private string RedirectUri => $"{_settings.CallbackBaseUrl.TrimEnd('/')}/api/v1/integrations/github/callback";
    private string WebhookUrl => $"{_settings.CallbackBaseUrl.TrimEnd('/')}/api/v1/webhooks/github";

    public string BuildAuthorizeUrl(string state)
    {
        var query = new Dictionary<string, string?>
        {
            ["client_id"] = _settings.ClientId,
            ["redirect_uri"] = RedirectUri,
            ["scope"] = _settings.Scope,
            ["state"] = state,
        };
        var qs = string.Join("&", query
            .Where(kv => !string.IsNullOrEmpty(kv.Value))
            .Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value!)}"));
        return $"{OAuthAuthorizeUrl}?{qs}";
    }

    public async Task<string?> ExchangeCodeForTokenAsync(string code, CancellationToken ct)
    {
        if (!IsConfigured) return null;
        try
        {
            var client = httpClientFactory.CreateClient("github");
            using var req = new HttpRequestMessage(HttpMethod.Post, OAuthTokenUrl);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            req.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _settings.ClientId!,
                ["client_secret"] = _settings.ClientSecret!,
                ["code"] = code,
                ["redirect_uri"] = RedirectUri,
            });

            var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("GitHub token exchange returned {Status}", resp.StatusCode);
                return null;
            }
            using var s = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(s, cancellationToken: ct);
            return doc.RootElement.TryGetProperty("access_token", out var t)
                ? t.GetString()
                : null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GitHub token exchange failed");
            return null;
        }
    }

    public async Task<long?> RegisterWebhookAsync(
        string repoFullName, string accessToken, string webhookSecret, CancellationToken ct)
    {
        try
        {
            var body = new
            {
                name = "web",
                active = true,
                events = new[] { "push", "pull_request", "pull_request_review", "check_run" },
                config = new
                {
                    url = WebhookUrl,
                    content_type = "json",
                    secret = webhookSecret,
                    insecure_ssl = "0",
                },
            };
            using var req = BuildApiRequest(
                HttpMethod.Post, $"/repos/{repoFullName}/hooks", accessToken, body);
            var client = httpClientFactory.CreateClient("github");
            var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("GitHub hook create returned {Status} for {Repo}",
                    resp.StatusCode, repoFullName);
                return null;
            }
            using var s = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(s, cancellationToken: ct);
            return doc.RootElement.TryGetProperty("id", out var id) && id.TryGetInt64(out var hookId)
                ? hookId
                : null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GitHub hook create failed for {Repo}", repoFullName);
            return null;
        }
    }

    public async Task DeleteWebhookAsync(
        string repoFullName, string accessToken, long webhookId, CancellationToken ct)
    {
        try
        {
            using var req = BuildApiRequest(
                HttpMethod.Delete, $"/repos/{repoFullName}/hooks/{webhookId}", accessToken, body: null);
            var client = httpClientFactory.CreateClient("github");
            await client.SendAsync(req, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GitHub hook delete failed for {Repo}/{Hook}", repoFullName, webhookId);
        }
    }

    public bool VerifyWebhookSignature(string? signatureHeader, byte[] body, string secret)
    {
        // GitHub sends "X-Hub-Signature-256: sha256=<hex>". Recompute the
        // HMAC over the exact bytes and compare in constant time.
        if (string.IsNullOrWhiteSpace(signatureHeader)) return false;
        const string prefix = "sha256=";
        if (!signatureHeader.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return false;

        var provided = signatureHeader[prefix.Length..].Trim();
        byte[] providedBytes;
        try
        {
            providedBytes = Convert.FromHexString(provided);
        }
        catch (FormatException)
        {
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var computed = hmac.ComputeHash(body);
        return CryptographicOperations.FixedTimeEquals(computed, providedBytes);
    }

    public async Task<GitHubRepoAccess> CheckRepoAccessAsync(
        string repoFullName, string? accessToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
            return GitHubRepoAccess.Unauthorized;
        try
        {
            using var req = BuildApiRequest(HttpMethod.Get, $"/repos/{repoFullName}", accessToken, body: null);
            var client = httpClientFactory.CreateClient("github");
            var resp = await client.SendAsync(req, ct);
            return (int)resp.StatusCode switch
            {
                >= 200 and < 300 => GitHubRepoAccess.Ok,
                401 or 403 => GitHubRepoAccess.Unauthorized,
                404 => GitHubRepoAccess.NotFound,
                _ => GitHubRepoAccess.Error,
            };
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "GitHub repo access check failed for {Repo}", repoFullName);
            return GitHubRepoAccess.Error;
        }
    }

    private HttpRequestMessage BuildApiRequest(
        HttpMethod method, string path, string accessToken, object? body)
    {
        var req = new HttpRequestMessage(method, $"{ApiBaseUrl}{path}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github+json"));
        // GitHub rejects requests without a User-Agent.
        req.Headers.UserAgent.ParseAdd("pm-platform");
        req.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        if (body is not null)
        {
            req.Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json");
        }
        return req;
    }
}
