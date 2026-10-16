using Application.Features.Auth;
using Domain.Entities;

namespace Unit.Security;

public class RefreshTokenPolicyTests
{
    private static readonly DateTime Now = new(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);

    private static RefreshToken Token(DateTime? revokedAt = null, Guid? replacedBy = null, int expiresInDays = 30) =>
        new()
        {
            UserId = Guid.NewGuid(),
            TokenHash = "h",
            ExpiresAt = Now.AddDays(expiresInDays),
            RevokedAt = revokedAt,
            ReplacedByTokenId = replacedBy,
        };

    [Fact]
    public void Unknown_WhenMissing() =>
        Assert.Equal(RefreshTokenState.Unknown, RefreshTokenPolicy.Classify(null, Now));

    [Fact]
    public void Active_WhenNotRevokedAndNotExpired() =>
        Assert.Equal(RefreshTokenState.Active, RefreshTokenPolicy.Classify(Token(), Now));

    [Fact]
    public void RotatedTokenPresentedAgain_IsReuse() =>
        Assert.Equal(RefreshTokenState.Reused,
            RefreshTokenPolicy.Classify(Token(revokedAt: Now.AddMinutes(-5), replacedBy: Guid.NewGuid()), Now));

    [Fact]
    public void LoggedOutToken_IsInactive_NotReuse() =>
        Assert.Equal(RefreshTokenState.Inactive,
            RefreshTokenPolicy.Classify(Token(revokedAt: Now.AddMinutes(-5)), Now));

    [Fact]
    public void ExpiredToken_IsInactive() =>
        Assert.Equal(RefreshTokenState.Inactive, RefreshTokenPolicy.Classify(Token(expiresInDays: -1), Now));

    [Fact]
    public void StartFamily_UsesTheTokenIdAsFamily()
    {
        var t = RefreshToken.StartFamily(Guid.NewGuid(), "h", Now.AddDays(30));
        Assert.Equal(t.Id, t.FamilyId);
        Assert.NotEqual(Guid.Empty, t.FamilyId);
    }
}