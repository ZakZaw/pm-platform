using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// F2-25 — current health of an <see cref="Integration"/>, refreshed by
/// the background monitor (one row per integration). Kept as a separate
/// table so the hot Integration row isn't rewritten on every 15-minute
/// probe and so health history could be added later without touching the
/// integration schema.
/// </summary>
public class IntegrationHealth
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid IntegrationId { get; set; }

    public IntegrationHealthStatus Status { get; set; } = IntegrationHealthStatus.Unknown;

    /// <summary>When the monitor last probed the integration.</summary>
    public DateTime? LastCheckedAt { get; set; }

    /// <summary>When the integration last responded healthily.</summary>
    public DateTime? LastSyncedAt { get; set; }

    /// <summary>Human-readable reason when not healthy.</summary>
    public string? ErrorMessage { get; set; }

    public Integration Integration { get; set; } = null!;
}
