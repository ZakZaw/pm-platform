namespace Application.Features.Analytics;

/// <summary>
/// Pure SLA-attainment math for the Support project dashboard. Attainment is
/// the share of resolved tickets that were resolved at or before their SLA due
/// time — the honest "did we hit our promise" number, distinct from the live
/// count of currently-breached open tickets. DB-free and unit-testable.
/// </summary>
public static class SlaAttainmentCalculator
{
    /// <summary>
    /// Percentage of resolved tickets that met their SLA (resolved at or before
    /// the due time). Returns null when nothing has been resolved in the window
    /// so the tile renders an em dash rather than 0%.
    /// </summary>
    public static double? AttainmentPct(IEnumerable<(DateTime ResolvedAt, DateTime SlaDueAt)> resolved)
    {
        int total = 0, met = 0;
        foreach (var (resolvedAt, slaDueAt) in resolved)
        {
            total++;
            if (resolvedAt <= slaDueAt) met++;
        }
        return total == 0 ? null : Math.Round(100.0 * met / total, 1);
    }
}
