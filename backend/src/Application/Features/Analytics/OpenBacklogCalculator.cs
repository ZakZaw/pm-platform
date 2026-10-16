namespace Application.Features.Analytics;

/// <summary>
/// Pure "how much was open at the time" reconstruction. Given items with an
/// open interval [Start, End) and a weight, it returns the weighted total that
/// was open at the end of each of the last <c>weeks</c> Monday-started weeks
/// (the current week samples at <c>asOf</c> instead of its future end), oldest
/// first. Used for the org home trend lines: open tickets per week (weight 1)
/// and open pipeline value per week (weight = deal value). No snapshots are
/// stored, so this is rebuilt from open/close timestamps — an item's
/// <em>current</em> weight is used for every past point. DB-free and
/// unit-testable.
/// </summary>
public static class OpenBacklogCalculator
{
    public readonly record struct Item(DateTime Start, DateTime? End, decimal Weight);

    public static IReadOnlyList<decimal> Weekly(IEnumerable<Item> items, DateTime asOf, int weeks)
    {
        weeks = Math.Max(1, weeks);
        var currentWeekStart = ThroughputCalculator.StartOfWeek(asOf.Date);
        var firstWeekStart = currentWeekStart.AddDays(-7 * (weeks - 1));

        var samples = new DateTime[weeks];
        for (var i = 0; i < weeks; i++)
        {
            var weekEnd = firstWeekStart.AddDays(7 * (i + 1));
            samples[i] = weekEnd > asOf ? asOf : weekEnd;
        }

        var totals = new decimal[weeks];
        foreach (var item in items)
        {
            for (var i = 0; i < weeks; i++)
            {
                var t = samples[i];
                if (item.Start <= t && (item.End is not { } end || end > t))
                    totals[i] += item.Weight;
            }
        }
        return totals;
    }
}
