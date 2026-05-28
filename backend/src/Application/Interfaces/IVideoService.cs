namespace Application.Interfaces;

/// <summary>
/// F2-20 — single seam between Application and a managed WebRTC
/// provider. The dev/prod implementation targets LiveKit; the contract
/// is provider-agnostic so swapping in Daily.co later is a single
/// service swap.
///
/// Tokens are short-lived JWTs scoped to a single room + identity.
/// Recording control returns an opaque egress id that the webhook
/// handler later correlates back to the meeting.
/// </summary>
public interface IVideoService
{
    /// <summary>Marketing / settings name surfaced to the UI.</summary>
    string ProviderName { get; }

    /// <summary>
    /// True when the provider has the URL + key + secret it needs to
    /// generate working tokens. When false, <see cref="MintAccessToken"/>
    /// returns a stub token so the rest of the app stays bootable, and
    /// the join endpoint surfaces a 503.
    /// </summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Public WSS URL clients connect to (e.g. <c>wss://demo.livekit.cloud</c>).
    /// Empty when unconfigured.
    /// </summary>
    string PublicUrl { get; }

    /// <summary>
    /// Mint a join token for the given room + identity. Members can
    /// publish; guests start as subscribe-only when <paramref name="canPublish"/>
    /// is false, which is the default for view-only invitees.
    /// </summary>
    VideoAccessToken MintAccessToken(
        string roomName,
        string identity,
        string displayName,
        bool canPublish,
        TimeSpan validFor);

    /// <summary>
    /// Best-effort start of room recording. Returns an egress id when
    /// the provider acknowledges; null when recording isn't configured
    /// (e.g. no S3 target) — the caller still records start time in
    /// the DB so the UI shows the badge.
    /// </summary>
    Task<string?> StartRoomRecordingAsync(string roomName, CancellationToken ct);

    /// <summary>Best-effort stop of room recording.</summary>
    Task StopRoomRecordingAsync(string egressId, CancellationToken ct);

    /// <summary>
    /// Validate a LiveKit webhook payload using the shared HMAC. The
    /// header is "Authorization: <jwt>" where the JWT's sub == the
    /// payload's hash. Throws when validation fails — the controller
    /// maps that to a 401 so an attacker can't drive state changes.
    /// </summary>
    void VerifyWebhookSignature(string authorizationHeader, string body);
}

/// <summary>
/// Single join credential. <see cref="Token"/> is the LiveKit access
/// JWT; <see cref="Url"/> is the WSS endpoint the client connects to;
/// <see cref="RoomName"/> is the canonical room id the token was scoped
/// to. <see cref="Identity"/> is what other participants see as the
/// peer identifier — we set it to the user id (or "guest:{token}" for
/// guest joins) so the F2-21 transcript can label speakers without
/// relying on voice diarisation.
/// </summary>
public record VideoAccessToken(
    string Token,
    string Url,
    string RoomName,
    string Identity,
    string DisplayName,
    DateTime ExpiresAt);
