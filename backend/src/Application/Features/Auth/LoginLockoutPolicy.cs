namespace Application.Features.Auth;

/// <summary>Failed-login bookkeeping for one account.</summary>
public sealed record LoginAttemptState(int Failures, DateTime WindowStart, DateTime? LockedUntil);

/// <summary>
/// H4 - per-account login lockout, independent of the per-IP limiter so
/// a distributed guessing attack against one account still stalls.
/// After <see cref="MaxFailures"/> failures inside <see cref="Window"/>
/// the account is locked for <see cref="LockoutDuration"/>. Pure, so it's
/// unit-testable; storage lives behind <c>ILoginAttemptStore</c>.
/// </summary>
public static class LoginLockoutPolicy
{
    public const int MaxFailures = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public static bool IsLocked(LoginAttemptState? state, DateTime now) =>
        state?.LockedUntil is { } until && until > now;

    public static LoginAttemptState RecordFailure(LoginAttemptState? state, DateTime now)
    {
        // A lapsed lock or an expired window starts a fresh count.
        if (state is null
            || (state.LockedUntil is { } until && until <= now)
            || now - state.WindowStart > Window)
            state = new LoginAttemptState(0, now, null);

        var failures = state.Failures + 1;
        return failures >= MaxFailures
            ? new LoginAttemptState(failures, state.WindowStart, now + LockoutDuration)
            : state with { Failures = failures };
    }
}