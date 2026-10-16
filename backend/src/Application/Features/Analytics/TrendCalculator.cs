namespace Application.Features.Analytics;

/// <summary>
/// Pure period-over-period helpers for KPI deltas. Returns null whenever the
/// comparison has no honest baseline (nothing in the previous period) so the
/// tile hides the delta instead of showing "+∞%" or a fabricated "+0%".
/// </summary>
public static class TrendCalculator
{
    /// <summary>Percent change from <paramref name="previous"/> to
    /// <paramref name="current"/>, rounded to a whole percent; null when the
    /// previous value is zero or negative.</summary>
    public static double? PercentChange(double current, double previous)
    {
        if (previous <= 0) return null;
        return Math.Round(100.0 * (current - previous) / previous);
    }

    /// <summary>Mean of the values, or null when empty.</summary>
    public static double? Mean(IReadOnlyCollection<double> values) =>
        values.Count == 0 ? null : Math.Round(values.Average(), 1);

    /// <summary>
    /// Compares the mean of the last <paramref name="window"/> values with the
    /// mean of the <paramref name="window"/> values before them. Series are
    /// oldest-first. Returns (current mean, previous mean) — either may be null
    /// when the series is too short.
    /// </summary>
    public static (double? Current, double? Previous) TrailingWindows(IReadOnlyList<double> series, int window)
    {
        window = Math.Max(1, window);
        var current = series.Skip(Math.Max(0, series.Count - window)).ToList();
        var prevEnd = Math.Max(0, series.Count - window);
        var previous = series.Take(prevEnd).Skip(Math.Max(0, prevEnd - window)).ToList();
        return (Mean(current), Mean(previous));
    }
}
