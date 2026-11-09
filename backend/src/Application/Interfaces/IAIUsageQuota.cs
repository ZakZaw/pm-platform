namespace Application.Interfaces;

/// <summary>
/// H4 - daily cap on AI calls. The partition is the org the call is billed
/// to ("org:{id}"), falling back to the caller ("user:{id}") for calls
/// with no org context.
/// </summary>
public interface IAIUsageQuota
{
    /// <summary>Counts one call; false when today's quota is already used up.</summary>
    bool TryConsume(string partition, DateTime utcNow);
}