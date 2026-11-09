namespace Application.Features.Roadmap;

/// <summary>
/// M4 - brute-force protection for password-gated share links, stored on
/// the link itself so it holds across instances and restarts. After
/// <see cref="MaxFailures"/> consecutive wrong passwords the link refuses
/// password attempts for <see cref="LockoutDuration"/>.
/// </summary>
public static class ShareLinkPasswordPolicy
{
    public const int MinLength = 8;
    public const int MaxLength = 128;
    public const int MaxFailures = 10;
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public static bool IsLocked(DateTime? lockedUntil, DateTime now) => lockedUntil is { } until && until > now;

    /// <summary>New (attempts, lockedUntil) after a wrong password.</summary>
    public static (int Attempts, DateTime? LockedUntil) RegisterFailure(int attempts, DateTime now)
    {
        var next = attempts + 1;
        return next >= MaxFailures ? (0, now + LockoutDuration) : (next, null);
    }
}