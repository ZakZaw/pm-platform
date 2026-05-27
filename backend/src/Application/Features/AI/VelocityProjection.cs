namespace Application.Features.AI;

/// <summary>
/// Pure projection math for F2-12. The scanner uses this to decide
/// whether a sprint's pace is bad enough that the AI should be asked
/// for a replan. Kept independent of EF so it's directly unit-testable.
///
/// The roadmap calls for "projected milestone delay >10 days" as the
/// trip wire. We expose two outputs:
/// <list type="bullet">
///   <item><see cref="VelocityProjectionResult.ProjectedShortfallPoints"/>
///     — how many points the sprint is on track to miss based on the
///     team's recent average pace, not the committed target. Negative
///     means the sprint is on track or ahead.</item>
///   <item><see cref="VelocityProjectionResult.ProjectedDaysBehind"/>
///     — same shortfall expressed in calendar days, using the
///     team's recent throughput rate (points per day). The scanner
///     compares this against the 10-day threshold.</item>
/// </list>
/// </summary>
public static class VelocityProjection
{
    public const int DefaultDelayThresholdDays = 10;

    /// <param name="committedPoints">Points planned at sprint start.</param>
    /// <param name="donePoints">Points completed so far.</param>
    /// <param name="daysElapsed">Days since the sprint started, clamped to [0, daysTotal].</param>
    /// <param name="daysTotal">Sprint length in days. Must be > 0.</param>
    /// <param name="recentVelocities">Last few closed sprints' final velocities.
    /// Pass an empty list when there's no history — we then fall back to
    /// the current sprint's own pace.</param>
    public static VelocityProjectionResult Project(
        int committedPoints,
        int donePoints,
        int daysElapsed,
        int daysTotal,
        IReadOnlyList<int> recentVelocities)
    {
        if (daysTotal <= 0) throw new ArgumentOutOfRangeException(nameof(daysTotal));
        var elapsed = Math.Clamp(daysElapsed, 0, daysTotal);

        // Recent average velocity = how many points the team historically
        // ships in one sprint of this length. Empty history → use the
        // pace from the current sprint as the best signal we have.
        double recentAverage;
        if (recentVelocities.Count > 0)
        {
            recentAverage = recentVelocities.Average();
        }
        else if (elapsed > 0)
        {
            recentAverage = donePoints / (double)elapsed * daysTotal;
        }
        else
        {
            // No elapsed time and no history — we can't project anything
            // meaningful. Report zero shortfall.
            return new VelocityProjectionResult(0, 0, 0, 0, 0);
        }

        // Forecast: at the historical pace, the team would deliver
        // recentAverage points across the whole sprint. The shortfall
        // is committed minus that forecast (positive = at risk).
        // We pick the more pessimistic of "historical pace" vs "current
        // pace projected to end of sprint" so a slow start isn't
        // smoothed away.
        var historicalForecast = recentAverage;
        var currentRateForecast = elapsed > 0
            ? donePoints / (double)elapsed * daysTotal
            : recentAverage;
        var projectedDelivered = Math.Min(historicalForecast, currentRateForecast);

        var shortfallPoints = Math.Max(0, committedPoints - projectedDelivered);

        // Convert points behind into calendar days behind, using the
        // team's recent throughput (points per day). Throughput of zero
        // is treated as "can't tell" — return 0 days behind so the
        // scanner doesn't fire a useless card.
        var pointsPerDay = recentAverage / daysTotal;
        var daysBehind = pointsPerDay > 0
            ? (int)Math.Round(shortfallPoints / pointsPerDay)
            : 0;

        return new VelocityProjectionResult(
            ProjectedDelivered: (int)Math.Round(projectedDelivered),
            ProjectedShortfallPoints: (int)Math.Round(shortfallPoints),
            ProjectedDaysBehind: daysBehind,
            RecentAverageVelocity: (int)Math.Round(recentAverage),
            PointsPerDay: Math.Round(pointsPerDay, 2));
    }
}

public record VelocityProjectionResult(
    int ProjectedDelivered,
    int ProjectedShortfallPoints,
    int ProjectedDaysBehind,
    int RecentAverageVelocity,
    double PointsPerDay);
