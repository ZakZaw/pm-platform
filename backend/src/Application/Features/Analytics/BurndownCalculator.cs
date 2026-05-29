namespace Application.Features.Analytics;

/// <summary>
/// Pure burndown series builder. Given the sprint window, the committed
/// point total, the "now" timestamp and the set of completion events (the
/// moment a scoped task reached Done plus its points), produces the daily
/// ideal line and actual-remaining line.
///
/// Days run from the sprint start date through the end date inclusive. Days
/// after <paramref name="now"/> carry a <c>null</c> remaining so the chart
/// stops drawing the actual line at today rather than implying future data.
/// Kept free of EF/DB types so it is unit-testable in isolation (mirrors
/// <see cref="AI.VelocityProjection"/>).
/// </summary>
public static class BurndownCalculator
{
    public readonly record struct Completion(DateTime CompletedAt, int Points);

    public readonly record struct Point(int DayIndex, DateTime Date, double Ideal, double? Remaining);

    public static IReadOnlyList<Point> Build(
        DateTime start,
        DateTime end,
        DateTime now,
        int totalPoints,
        IEnumerable<Completion> completions)
    {
        var startDay = start.Date;
        var endDay = end.Date;
        // At least a one-day window so the ideal slope is well defined even
        // when start == end.
        var days = Math.Max(1, (int)(endDay - startDay).TotalDays);
        var completionList = completions as IReadOnlyList<Completion> ?? completions.ToList();

        var points = new List<Point>(days + 1);
        for (var i = 0; i <= days; i++)
        {
            var date = startDay.AddDays(i);
            var ideal = totalPoints - (double)totalPoints / days * i;

            double? remaining = null;
            if (date <= now.Date)
            {
                // Points burned down by the END of this calendar day.
                var dayEnd = date.AddDays(1);
                var completedByDay = completionList
                    .Where(c => c.CompletedAt < dayEnd)
                    .Sum(c => c.Points);
                remaining = Math.Max(0, totalPoints - completedByDay);
            }

            points.Add(new Point(i, date, Math.Round(ideal, 2), remaining));
        }

        return points;
    }

    /// <summary>Zero-based index of "today" within the sprint window,
    /// clamped to the drawable range.</summary>
    public static int TodayIndex(DateTime start, DateTime end, DateTime now)
    {
        var days = Math.Max(1, (int)(end.Date - start.Date).TotalDays);
        var elapsed = (int)(now.Date - start.Date).TotalDays;
        return Math.Clamp(elapsed, 0, days);
    }
}
