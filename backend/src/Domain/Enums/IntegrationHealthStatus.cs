namespace Domain.Enums;

/// <summary>
/// F2-25 — rolled-up health of an <see cref="Entities.Integration"/>, set
/// by the periodic monitor. <c>Unknown</c> until the first probe;
/// <c>Degraded</c> for a transient reachability problem (yellow);
/// <c>Failed</c> when the token is rejected or the repo is gone (red,
/// alerts the PM).
/// </summary>
public enum IntegrationHealthStatus
{
    Unknown = 0,
    Healthy = 1,
    Degraded = 2,
    Failed = 3,
}
