using Application.Features.Roadmap;

namespace Unit.Security;

public class ShareLinkPasswordPolicyTests
{
    private static readonly DateTime Now = new(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void LocksAfterMaxFailures_AndResetsTheCounter()
    {
        var attempts = 0;
        DateTime? lockedUntil = null;
        for (var i = 0; i < ShareLinkPasswordPolicy.MaxFailures; i++)
        {
            Assert.False(ShareLinkPasswordPolicy.IsLocked(lockedUntil, Now));
            (attempts, lockedUntil) = ShareLinkPasswordPolicy.RegisterFailure(attempts, Now);
        }

        Assert.Equal(0, attempts);
        Assert.True(ShareLinkPasswordPolicy.IsLocked(lockedUntil, Now.AddMinutes(1)));
        Assert.False(ShareLinkPasswordPolicy.IsLocked(lockedUntil, Now + ShareLinkPasswordPolicy.LockoutDuration));
    }

    [Fact]
    public void BelowTheThreshold_OnlyCounts()
    {
        var (attempts, lockedUntil) = ShareLinkPasswordPolicy.RegisterFailure(3, Now);
        Assert.Equal(4, attempts);
        Assert.Null(lockedUntil);
    }

    [Fact]
    public void MinimumLength_IsEight() => Assert.Equal(8, ShareLinkPasswordPolicy.MinLength);
}