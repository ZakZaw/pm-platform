namespace Application.Features.Analytics;

/// <summary>
/// Pure weekly-bucketing for throughput trends — used by the Marketing
/// dashboard to chart assets shipped per week, but type-agnostic. Buckets a set
/// of dates into consecutive Monday-started 7-day windows ending with the week
/// containing <c>asOf</c>, oldest first, so the result feeds a left-to-right
/// sparkline directly. DB-free and unit-testable.
/// </summary>
public static class ThroughputCalculator
{
    public record WeekBucket(DateTime WeekStart, int Count);

    public static IReadOnlyList<WeekBucket> Weekly(IEnumerable<DateTime> dates, DateTime asOf, int weeks)
    {
        weeks = Math.Max(1, weeks);
        var currentWeekStart = StartOfWeek(asOf.Date);
        var firstWeekStart = currentWeekStart.AddDays(-7 * (weeks - 1));

        var counts = new int[weeks];
        foreach (var d in dates)
        {
            var idx = (int)((StartOfWeek(d.Date) - firstWeekStart).TotalDays / 7);
            if (idx >= 0 && idx < weeks) counts[idx]++;
        }

        var result = new List<WeekBucket>(weeks);
        for (var i = 0; i < weeks; i++)
            result.Add(new WeekBucket(firstWeekStart.AddDays(7 * i), counts[i]));
        return result;
    }

    public record WeekSum(DateTime WeekStart, double Total);

    /// <summary>
    /// Weighted variant of <see cref="Weekly"/>: sums a value (e.g. story
    /// points) per Monday-started week instead of counting events. Same window
    /// and ordering rules — oldest first, ending with the week containing
    /// <paramref name="asOf"/>.
    /// </summary>
    public static IReadOnlyList<WeekSum> WeeklySum(
        IEnumerable<(DateTime Date, double Value)> items, DateTime asOf, int weeks)
    {
        weeks = Math.Max(1, weeks);
        var currentWeekStart = StartOfWeek(asOf.Date);
        var firstWeekStart = currentWeekStart.AddDays(-7 * (weeks - 1));

        var sums = new double[weeks];
        foreach (var (date, value) in items)
        {
            var idx = (int)((StartOfWeek(date.Date) - firstWeekStart).TotalDays / 7);
            if (idx >= 0 && idx < weeks) sums[idx] += value;
        }

        var result = new List<WeekSum>(weeks);
        for (var i = 0; i < weeks; i++)
            result.Add(new WeekSum(firstWeekStart.AddDays(7 * i), sums[i]));
        return result;
    }

    // Monday-aligned week start (Monday = 0).
    internal static DateTime StartOfWeek(DateTime d) =>
        d.AddDays(-(((int)d.DayOfWeek + 6) % 7));
}
