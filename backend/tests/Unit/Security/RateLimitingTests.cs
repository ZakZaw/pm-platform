using System.Net;
using System.Security.Claims;
using Api.Middleware;
using Application.Features.Auth;
using Infrastructure.Auth;
using Infrastructure.Services;
using Infrastructure.Services.Ai;
using Microsoft.Extensions.Options;

namespace Unit.Security;

public class RateLimitPartitionTests
{
    private static readonly IPAddress Ip = IPAddress.Parse("203.0.113.7");

    [Fact]
    public void Anonymous_IsPartitionedByIp()
    {
        Assert.Equal("ip:203.0.113.7", RateLimitPartition.Resolve(new ClaimsPrincipal(new ClaimsIdentity()), Ip));
        Assert.Equal("ip:unknown", RateLimitPartition.Resolve(null, null));
    }

    [Fact]
    public void UnverifiedApiKeyHeader_DoesNotBuyANewBucket()
    {
        // A request with a random X-Api-Key fails authentication, so the
        // principal is anonymous: every such request shares the IP bucket.
        var a = RateLimitPartition.Resolve(new ClaimsPrincipal(new ClaimsIdentity()), Ip);
        var b = RateLimitPartition.Resolve(new ClaimsPrincipal(new ClaimsIdentity()), Ip);
        Assert.Equal(a, b);
    }

    [Fact]
    public void JwtUser_IsPartitionedByUserId()
    {
        var id = Guid.NewGuid();
        var user = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "Bearer"));
        Assert.Equal("user:" + id.ToString("D"), RateLimitPartition.Resolve(user, Ip));
    }

    [Fact]
    public void VerifiedApiKey_IsPartitionedByKeyId_EvenAlongsideAJwt()
    {
        var keyId = Guid.NewGuid();
        var jwt = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "Bearer");
        var key = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()),
            new Claim(ApiKeyAuthenticationHandler.ApiKeyIdClaim, keyId.ToString()),
        ], ApiKeyAuthenticationHandler.SchemeName);

        Assert.Equal("key:" + keyId, RateLimitPartition.Resolve(new ClaimsPrincipal([jwt, key]), Ip));
    }
}

public class LoginLockoutPolicyTests
{
    private static readonly DateTime T0 = new(2026, 10, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void LocksAfterMaxFailures_ThenUnlocksAfterDuration()
    {
        LoginAttemptState? s = null;
        for (var i = 0; i < LoginLockoutPolicy.MaxFailures - 1; i++)
        {
            s = LoginLockoutPolicy.RecordFailure(s, T0.AddSeconds(i));
            Assert.False(LoginLockoutPolicy.IsLocked(s, T0.AddSeconds(i)));
        }

        s = LoginLockoutPolicy.RecordFailure(s, T0.AddMinutes(1));
        Assert.True(LoginLockoutPolicy.IsLocked(s, T0.AddMinutes(2)));
        Assert.False(LoginLockoutPolicy.IsLocked(s, T0.AddMinutes(1) + LoginLockoutPolicy.LockoutDuration));
    }

    [Fact]
    public void FailuresOutsideTheWindow_DoNotAccumulate()
    {
        LoginAttemptState? s = null;
        for (var i = 0; i < 10; i++)
            s = LoginLockoutPolicy.RecordFailure(s, T0 + (LoginLockoutPolicy.Window + TimeSpan.FromMinutes(1)) * i);

        Assert.False(LoginLockoutPolicy.IsLocked(s, T0 + (LoginLockoutPolicy.Window + TimeSpan.FromMinutes(1)) * 9));
        Assert.Equal(1, s!.Failures);
    }

    [Fact]
    public void AfterLockExpires_CountStartsOver()
    {
        LoginAttemptState? s = null;
        for (var i = 0; i < LoginLockoutPolicy.MaxFailures; i++)
            s = LoginLockoutPolicy.RecordFailure(s, T0);
        var later = T0 + LoginLockoutPolicy.LockoutDuration + TimeSpan.FromSeconds(1);

        s = LoginLockoutPolicy.RecordFailure(s, later);
        Assert.Equal(1, s.Failures);
        Assert.False(LoginLockoutPolicy.IsLocked(s, later));
    }
}

public class AIUsageQuotaTests
{
    private static InMemoryAIUsageQuota Quota(int limit) =>
        new(Options.Create(new AISettings { DailyQuota = limit }));

    [Fact]
    public void AllowsUpToTheLimit_PerPartition()
    {
        var q = Quota(3);
        var day = new DateTime(2026, 10, 1, 9, 0, 0, DateTimeKind.Utc);

        Assert.True(q.TryConsume("org:a", day));
        Assert.True(q.TryConsume("org:a", day));
        Assert.True(q.TryConsume("org:a", day));
        Assert.False(q.TryConsume("org:a", day));
        Assert.True(q.TryConsume("org:b", day));
    }

    [Fact]
    public void ResetsAtUtcMidnight()
    {
        var q = Quota(1);
        var day = new DateTime(2026, 10, 1, 23, 59, 0, DateTimeKind.Utc);
        Assert.True(q.TryConsume("org:a", day));
        Assert.False(q.TryConsume("org:a", day));
        Assert.True(q.TryConsume("org:a", day.AddMinutes(2)));
    }

    [Fact]
    public void ZeroDisablesTheCap()
    {
        var q = Quota(0);
        for (var i = 0; i < 1000; i++)
            Assert.True(q.TryConsume("org:a", DateTime.UtcNow));
    }
}