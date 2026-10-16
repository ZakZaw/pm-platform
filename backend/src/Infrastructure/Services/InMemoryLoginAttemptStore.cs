using Application.Features.Auth;
using Application.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace Infrastructure.Services;

/// <summary>
/// Per-instance login-attempt store. Entries expire on their own, and the
/// cache has a size limit, so memory stays bounded however many accounts
/// are probed. A multi-node deployment would move this to a shared store.
/// </summary>
public sealed class InMemoryLoginAttemptStore : ILoginAttemptStore, IDisposable
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 100_000 });

    public LoginAttemptState? Get(string accountKey) =>
        _cache.TryGetValue(accountKey, out LoginAttemptState? state) ? state : null;

    public void Set(string accountKey, LoginAttemptState state) =>
        _cache.Set(accountKey, state, new MemoryCacheEntryOptions
        {
            Size = 1,
            AbsoluteExpirationRelativeToNow = LoginLockoutPolicy.Window + LoginLockoutPolicy.LockoutDuration,
        });

    public void Clear(string accountKey) => _cache.Remove(accountKey);

    public void Dispose() => _cache.Dispose();
}