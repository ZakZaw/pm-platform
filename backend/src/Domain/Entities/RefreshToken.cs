namespace Domain.Entities;

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public required DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAt { get; set; }
    public Guid? ReplacedByTokenId { get; set; }

    /// <summary>
    /// M3 - every token minted by rotating a login's token shares the
    /// login's family id. Presenting an already-rotated token again means
    /// the chain leaked, so the whole family is revoked.
    /// </summary>
    public Guid FamilyId { get; set; }

    public User User { get; set; } = null!;

    public bool IsActive => RevokedAt is null && DateTime.UtcNow < ExpiresAt;

    /// <summary>Starts a new token family (sign-in / sign-up).</summary>
    public static RefreshToken StartFamily(Guid userId, string tokenHash, DateTime expiresAt)
    {
        var token = new RefreshToken { UserId = userId, TokenHash = tokenHash, ExpiresAt = expiresAt };
        token.FamilyId = token.Id;
        return token;
    }
}
