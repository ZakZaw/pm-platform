using Application.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Infrastructure.Services;

public class PasswordHasher : IPasswordHasher
{
    private sealed class PasswordOwner { }

    private readonly PasswordHasher<PasswordOwner> _inner = new();
    private readonly PasswordOwner _owner = new();

    public string Hash(string password) => _inner.HashPassword(_owner, password);

    public bool Verify(string hash, string password)
    {
        var result = _inner.VerifyHashedPassword(_owner, hash, password);
        return result == PasswordVerificationResult.Success
            || result == PasswordVerificationResult.SuccessRehashNeeded;
    }
}
