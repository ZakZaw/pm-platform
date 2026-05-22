namespace Domain.Enums;

/// <summary>
/// Distribution channel for a Marketing campaign. Each channel has a
/// theme-aware token (`--mkt-channel-*`) used to colour the content
/// calendar so PMs can scan publish density at a glance.
/// </summary>
public enum MarketingChannel
{
    Email,
    Social,
    Blog,
    Paid,
    Event,
    Other
}
