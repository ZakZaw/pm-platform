namespace Domain.Entities;

/// <summary>
/// F2-20 — opaque token an organiser shares with someone outside the
/// org so they can join a meeting without an account. The token lands
/// in a public URL (<c>/meetings/guest/{token}</c>) and the join
/// endpoint accepts it without authentication; access expires at
/// <see cref="ExpiresAt"/> or when an organiser hits <c>revoke</c>.
/// </summary>
public class MeetingGuestLink
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MeetingId { get; set; }
    public Guid CreatedByUserId { get; set; }

    /// <summary>URL-safe random string. Indexed unique; we never look
    /// up by id from the public path.</summary>
    public required string Token { get; set; }

    /// <summary>Optional display label shown next to the guest in the
    /// room. Defaults to "Guest" client-side when blank.</summary>
    public string? GuestLabel { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public Meeting Meeting { get; set; } = null!;
}
