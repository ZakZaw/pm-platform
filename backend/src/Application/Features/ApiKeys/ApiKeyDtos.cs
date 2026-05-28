namespace Application.Features.ApiKeys;

/// <summary>F2-24 — an issued API key as shown in settings. Never carries
/// the secret (only the non-secret prefix).</summary>
public record ApiKeyDto(
    Guid Id,
    string Name,
    string Prefix,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime? LastUsedAt,
    DateTime? ExpiresAt,
    DateTime? RevokedAt,
    bool IsActive);

/// <summary>Returned only by the create endpoint — carries the full
/// <see cref="Secret"/> exactly once so the caller can copy it.</summary>
public record CreatedApiKeyDto(ApiKeyDto Key, string Secret);
