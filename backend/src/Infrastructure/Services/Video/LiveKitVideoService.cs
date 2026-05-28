using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Services.Video;

/// <summary>
/// LiveKit-backed <see cref="IVideoService"/>. Implements the
/// LiveKit access-token contract directly so we don't pull in a NuGet
/// for what amounts to one HS256 JWT plus a JSON claim.
///
/// <para>
/// LiveKit auth shape (server SDK reference):
///   header: { alg: HS256, typ: JWT }
///   payload: { iss: api_key, sub: identity, nbf, exp, name, video: {...grants} }
///   signature: HMAC-SHA256 over header+payload using api_secret bytes.
/// </para>
///
/// When the settings are blank we stay registered but report
/// <see cref="IsConfigured"/> false and return stub tokens that the
/// frontend treats as a graceful "video unavailable" state. The rest
/// of the app stays bootable in environments without LiveKit creds.
/// </summary>
public class LiveKitVideoService(
    IOptions<VideoSettings> options,
    ILogger<LiveKitVideoService> logger,
    IHttpClientFactory httpClientFactory) : IVideoService
{
    private readonly VideoSettings _settings = options.Value;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public string ProviderName => "livekit";
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.Url)
        && !string.IsNullOrWhiteSpace(_settings.ApiKey)
        && !string.IsNullOrWhiteSpace(_settings.ApiSecret);
    public string PublicUrl => _settings.Url ?? string.Empty;

    public VideoAccessToken MintAccessToken(
        string roomName, string identity, string displayName,
        bool canPublish, TimeSpan validFor)
    {
        var expiresAt = DateTime.UtcNow.Add(validFor);

        if (!IsConfigured)
        {
            // Stub token so the caller can decide whether to surface
            // "video not configured" or render a disabled UI without
            // having to short-circuit at every callsite.
            return new VideoAccessToken(
                Token: string.Empty,
                Url: PublicUrl,
                RoomName: roomName,
                Identity: identity,
                DisplayName: displayName,
                ExpiresAt: expiresAt);
        }

        // LiveKit's grant claim shape — keep the snake_case keys, the
        // server SDK rejects camelCase.
        var grant = new Dictionary<string, object>
        {
            ["room"] = roomName,
            ["roomJoin"] = true,
            ["canPublish"] = canPublish,
            ["canSubscribe"] = true,
            ["canPublishData"] = true,
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.ApiSecret!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.ApiKey,
            claims: new[]
            {
                new Claim("sub", identity),
                new Claim("name", displayName),
                new Claim("video", JsonSerializer.Serialize(grant, JsonOpts),
                    JsonClaimValueTypes.Json),
            },
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: creds);
        var jwt = new JwtSecurityTokenHandler().WriteToken(token);

        return new VideoAccessToken(
            Token: jwt,
            Url: PublicUrl,
            RoomName: roomName,
            Identity: identity,
            DisplayName: displayName,
            ExpiresAt: expiresAt);
    }

    public async Task<string?> StartRoomRecordingAsync(string roomName, CancellationToken ct)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(_settings.RecordingBucket))
            return null;

        // LiveKit's egress endpoint is HTTP POST to /twirp/livekit.Egress/StartRoomCompositeEgress
        // with the same JWT auth. We post a minimal payload and let LiveKit
        // hand us back the egress id. Failures here are non-fatal — we log
        // and return null so the meeting continues without recording.
        try
        {
            var body = new
            {
                room_name = roomName,
                layout = "speaker",
                file = new
                {
                    filepath = $"recordings/{roomName}-{DateTime.UtcNow:yyyyMMddHHmmss}.mp4",
                    s3 = new
                    {
                        bucket = _settings.RecordingBucket,
                        region = _settings.RecordingRegion ?? "us-east-1",
                        access_key = _settings.RecordingAccessKey ?? string.Empty,
                        secret = _settings.RecordingSecretKey ?? string.Empty,
                    },
                },
            };
            var client = httpClientFactory.CreateClient("livekit");
            client.BaseAddress ??= new Uri(EgressBaseUrl());
            var req = new HttpRequestMessage(HttpMethod.Post,
                "/twirp/livekit.Egress/StartRoomCompositeEgress")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(body, JsonOpts),
                    Encoding.UTF8, "application/json"),
            };
            // Egress endpoints require the same room-grant JWT, scoped
            // to the room being recorded.
            var adminToken = MintAdminToken(roomName);
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);

            var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("LiveKit egress start returned {Status} for room {Room}",
                    resp.StatusCode, roomName);
                return null;
            }
            using var s = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(s, cancellationToken: ct);
            return doc.RootElement.TryGetProperty("egress_id", out var eg)
                ? eg.GetString()
                : null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "LiveKit egress start failed for room {Room}", roomName);
            return null;
        }
    }

    public async Task StopRoomRecordingAsync(string egressId, CancellationToken ct)
    {
        if (!IsConfigured) return;
        try
        {
            var client = httpClientFactory.CreateClient("livekit");
            client.BaseAddress ??= new Uri(EgressBaseUrl());
            var req = new HttpRequestMessage(HttpMethod.Post,
                "/twirp/livekit.Egress/StopEgress")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(new { egress_id = egressId }, JsonOpts),
                    Encoding.UTF8, "application/json"),
            };
            var adminToken = MintAdminToken(roomName: string.Empty);
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", adminToken);
            await client.SendAsync(req, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "LiveKit egress stop failed for {Egress}", egressId);
        }
    }

    public void VerifyWebhookSignature(string authorizationHeader, string body)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Video is not configured.");
        if (string.IsNullOrWhiteSpace(authorizationHeader))
            throw new UnauthorizedAccessException("Missing webhook Authorization header.");

        // Header form is "<jwt>" (no Bearer prefix in LiveKit's spec) —
        // be tolerant either way.
        var raw = authorizationHeader.Trim();
        if (raw.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            raw = raw["Bearer ".Length..];

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.ApiSecret!));
        var validation = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _settings.ApiKey,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2),
            IssuerSigningKey = key,
            ValidateIssuerSigningKey = true,
        };

        var handler = new JwtSecurityTokenHandler();
        var principal = handler.ValidateToken(raw, validation, out var validated);

        // LiveKit binds the body to the token by setting `sub` to the
        // SHA-256 hash of the request body. Compare so a replay with a
        // different payload doesn't pass.
        var expectedHash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
        var sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value ?? string.Empty;
        if (!string.Equals(sub, expectedHash, StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Webhook body hash mismatch.");
    }

    private string EgressBaseUrl()
    {
        // The egress endpoint uses HTTPS while the client uses WSS.
        // Convert wss:// → https:// (and ws:// → http:// for self-hosted).
        var url = _settings.Url!.Trim();
        if (url.StartsWith("wss://", StringComparison.OrdinalIgnoreCase))
            return "https://" + url["wss://".Length..];
        if (url.StartsWith("ws://", StringComparison.OrdinalIgnoreCase))
            return "http://" + url["ws://".Length..];
        return url;
    }

    private string MintAdminToken(string roomName)
    {
        var grant = new Dictionary<string, object>
        {
            ["roomAdmin"] = true,
            ["roomRecord"] = true,
        };
        if (!string.IsNullOrEmpty(roomName)) grant["room"] = roomName;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.ApiSecret!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _settings.ApiKey,
            claims: new[]
            {
                new Claim("sub", "server"),
                new Claim("video", JsonSerializer.Serialize(grant, JsonOpts),
                    JsonClaimValueTypes.Json),
            },
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(5),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
