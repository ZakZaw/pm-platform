namespace Domain.Entities;

/// <summary>
/// F2-24 — a service-to-service credential for the public REST API, an
/// alternative to a user JWT. Scoped to an organization and created by
/// an org admin; requests authenticated with the key act as the
/// <see cref="CreatedByUserId"/> user, so the existing membership-based
/// authorization keeps working unchanged.
///
/// The raw secret is shown to the creator exactly once. We persist only
/// its SHA-256 hash (<see cref="KeyHash"/>) plus a short non-secret
/// <see cref="Prefix"/> for display ("pmk_abc123…").
/// </summary>
public class ApiKey
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }

    public required string Name { get; set; }

    /// <summary>Non-secret leading slice shown in the UI to identify the
    /// key without revealing it.</summary>
    public required string Prefix { get; set; }

    /// <summary>SHA-256 hex of the full secret. Looked up on every API
    /// request, so it's uniquely indexed.</summary>
    public required string KeyHash { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Last time the key authenticated a request (throttled to
    /// at most one write per minute).</summary>
    public DateTime? LastUsedAt { get; set; }

    /// <summary>Optional hard expiry. Null = never expires.</summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>Set when an admin revokes the key; revoked keys fail auth.</summary>
    public DateTime? RevokedAt { get; set; }

    public Organization Organization { get; set; } = null!;
    public User CreatedBy { get; set; } = null!;

    public bool IsActive(DateTime now) =>
        RevokedAt is null && (ExpiresAt is null || ExpiresAt > now);
}
