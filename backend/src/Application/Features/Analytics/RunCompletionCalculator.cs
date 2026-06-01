namespace Application.Features.Analytics;

/// <summary>
/// Pure run-completion math for the Operations project dashboard. Over a window
/// of scheduled workflow runs it derives the completion rate, the on-time rate
/// (among completed runs), and the skip rate — the honest, window-based
/// replacement for the old "was the last run skipped?" heuristic. DB-free and
/// unit-testable.
/// </summary>
public static class RunCompletionCalculator
{
    /// <param name="Completed">Runs finished in the window.</param>
    /// <param name="OnTime">Of the completed runs, how many finished by their scheduled day.</param>
    /// <param name="Skipped">Runs explicitly skipped (with a reason).</param>
    /// <param name="Missed">Runs whose scheduled time passed without being completed or skipped.</param>
    public readonly record struct Inputs(int Completed, int OnTime, int Skipped, int Missed);

    public record Rates(double? CompletionPct, double? OnTimePct, double? SkipPct, int Total);

    public static Rates Compute(Inputs i)
    {
        var total = i.Completed + i.Skipped + i.Missed;
        if (total == 0) return new Rates(null, null, null, 0);

        var completion = Math.Round(100.0 * i.Completed / total, 1);
        var skip = Math.Round(100.0 * i.Skipped / total, 1);
        // On-time is only meaningful relative to the runs that actually completed.
        double? onTime = i.Completed == 0 ? null : Math.Round(100.0 * i.OnTime / i.Completed, 1);
        return new Rates(completion, onTime, skip, total);
    }
}
