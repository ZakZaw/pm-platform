using Application.Features.Auth;

namespace Application.Interfaces;

/// <summary>Where <see cref="LoginLockoutPolicy"/> state is kept (keyed by normalized email).</summary>
public interface ILoginAttemptStore
{
    LoginAttemptState? Get(string accountKey);
    void Set(string accountKey, LoginAttemptState state);
    void Clear(string accountKey);
}