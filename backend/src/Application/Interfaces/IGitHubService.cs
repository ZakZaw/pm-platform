namespace Application.Interfaces;

/// <summary>
/// F2-23 — GitHub source-control adapter. Wraps the OAuth handshake,
/// repo-webhook registration, and inbound-webhook signature checks.
/// Like the AI / video services it stays registered even when no
/// client credentials are configured; <see cref="IsConfigured"/> gates
/// the OAuth endpoints so the app stays bootable without GitHub creds.
/// </summary>
public interface IGitHubService
{
    /// <summary>True once the OAuth client id + secret are configured.</summary>
    bool IsConfigured { get; }

    /// <summary>Build the GitHub authorize URL the browser is redirected
    /// to. <paramref name="state"/> is the opaque CSRF/return token we
    /// later verify in the callback.</summary>
    string BuildAuthorizeUrl(string state);

    /// <summary>Exchange an OAuth <paramref name="code"/> for a user
    /// access token. Returns null when GitHub rejects the exchange.</summary>
    Task<string?> ExchangeCodeForTokenAsync(string code, CancellationToken ct);

    /// <summary>Register the repo push/PR/CI webhook pointing back at
    /// our receiver, signed with <paramref name="webhookSecret"/>.
    /// Best-effort: returns the GitHub hook id on success, null on any
    /// failure (e.g. the receiver isn't publicly reachable in dev).</summary>
    Task<long?> RegisterWebhookAsync(
        string repoFullName, string accessToken, string webhookSecret, CancellationToken ct);

    /// <summary>Delete a previously-registered repo webhook. Best-effort;
    /// swallows failures so disconnect never blocks on GitHub.</summary>
    Task DeleteWebhookAsync(
        string repoFullName, string accessToken, long webhookId, CancellationToken ct);

    /// <summary>Constant-time HMAC-SHA256 verification of an inbound
    /// webhook. <paramref name="signatureHeader"/> is the raw
    /// <c>X-Hub-Signature-256</c> value ("sha256=…"); <paramref name="body"/>
    /// is the exact bytes received.</summary>
    bool VerifyWebhookSignature(string? signatureHeader, byte[] body, string secret);
}
