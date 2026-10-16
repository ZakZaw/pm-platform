namespace Application.Features.Analytics;

/// <summary>
/// Pure sales-funnel + forecast math for the Sales project dashboard. Given the
/// ordered open-pipeline stages it produces funnel rows whose conversion is
/// expressed relative to the funnel entry (the first stage), and the
/// probability-weighted forecast over open deals. DB-free so the numbers are
/// unit-testable and identical regardless of caller — the Sales counterpart to
/// the engineering <see cref="BurndownCalculator"/>.
/// </summary>
public static class SalesFunnelCalculator
{
    public readonly record struct StageInput(string Name, int Count, decimal Value);

    public const string DefaultCurrency = "USD";

    /// <summary>Upper-cased ISO code; blank means the default currency.</summary>
    public static string NormalizeCurrency(string? currency) =>
        string.IsNullOrWhiteSpace(currency) ? DefaultCurrency : currency.Trim().ToUpperInvariant();

    /// <summary>
    /// M9 - money can't be summed across currencies, so dashboards report in
    /// one currency: the one holding the most value (ties: most deals, then
    /// alphabetical). Deals in other currencies are left out of the money
    /// totals and listed in <c>Others</c> so the UI can say so.
    /// </summary>
    public static (string Currency, IReadOnlyList<string> Others) ReportingCurrency(
        IEnumerable<(string? Currency, decimal Value)> deals)
    {
        var groups = deals
            .GroupBy(d => NormalizeCurrency(d.Currency))
            .Select(g => new { Code = g.Key, Total = g.Sum(d => d.Value), Count = g.Count() })
            .OrderByDescending(g => g.Total).ThenByDescending(g => g.Count).ThenBy(g => g.Code, StringComparer.Ordinal)
            .ToList();
        if (groups.Count == 0) return (DefaultCurrency, []);
        return (groups[0].Code, groups.Skip(1).Select(g => g.Code).OrderBy(c => c, StringComparer.Ordinal).ToList());
    }

    public static bool IsIn(string? currency, string reportingCurrency) =>
        NormalizeCurrency(currency) == reportingCurrency;

    public record FunnelStage(string Name, int Count, decimal Value, double ConversionPct);

    /// <summary>
    /// Funnel rows with each stage's conversion expressed as a share of the
    /// entry stage (the first row). When the entry stage is empty we fall back
    /// to the widest stage so the bars still normalise sensibly rather than all
    /// collapsing to zero.
    /// </summary>
    public static IReadOnlyList<FunnelStage> Funnel(IReadOnlyList<StageInput> stages)
    {
        if (stages.Count == 0) return [];
        var baseline = stages[0].Count;
        if (baseline == 0) baseline = stages.Max(s => s.Count);

        return stages
            .Select(s => new FunnelStage(
                s.Name, s.Count, s.Value,
                baseline > 0 ? Math.Round(100.0 * s.Count / baseline, 1) : 0))
            .ToList();
    }

    /// <summary>Σ value × probability — the probability-weighted expected value
    /// of the open pipeline. Probability is clamped to 0–100.</summary>
    public static decimal WeightedForecast(IEnumerable<(decimal Value, int Probability)> deals) =>
        deals.Sum(d => d.Value * Math.Clamp(d.Probability, 0, 100) / 100m);

    /// <summary>Won / (Won + Lost) as a percentage; null when nothing has
    /// closed yet so the UI shows an em dash rather than a misleading 0%.</summary>
    public static double? WinRatePct(int won, int lost)
    {
        var closed = won + lost;
        return closed == 0 ? null : Math.Round(100.0 * won / closed, 1);
    }
}
