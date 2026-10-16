using Domain.Entities;

namespace Application.Features.Auth;

public enum RefreshTokenState
{
    /// <summary>No such token.</summary>
    Unknown,
    /// <summary>Usable: not revoked, not expired.</summary>
    Active,
    /// <summary>Expired, or revoked without a successor (logout).</summary>
    Inactive,
    /// <summary>Already rotated and presented again: the token leaked.</summary>
    Reused,
}

/// <summary>M3 - classifies a presented refresh token. Pure, for unit tests.</summary>
public static class RefreshTokenPolicy
{
    public static RefreshTokenState Classify(RefreshToken? token, DateTime now)
    {
        if (token is null) return RefreshTokenState.Unknown;
        if (token.RevokedAt is not null)
            return token.ReplacedByTokenId is not null ? RefreshTokenState.Reused : RefreshTokenState.Inactive;
        return now < token.ExpiresAt ? RefreshTokenState.Active : RefreshTokenState.Inactive;
    }
}