namespace Application.Features.Analytics;

/// <summary>
/// Pure average cycle-time helper. Cycle time for a task is the span from the
/// first time it entered InProgress to the last time it reached Done. Spans
/// where the end precedes the start (out-of-order history) are ignored.
/// Returns null when there is nothing to average so the UI shows an em dash
/// instead of a fabricated zero.
/// </summary>
public static class CycleTimeCalculator
{
    public static double? AverageDays(IEnumerable<(DateTime Start, DateTime End)> spans)
    {
        var valid = spans.Where(s => s.End >= s.Start).ToList();
        if (valid.Count == 0) return null;
        return Math.Round(valid.Average(s => (s.End - s.Start).TotalDays), 1);
    }
}
