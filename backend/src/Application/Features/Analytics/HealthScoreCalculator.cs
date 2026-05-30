namespace Application.Features.Analytics;

/// <summary>
/// Pure composite project-health score (0–100). Kept DB-free so the formula is
/// unit-testable and identical regardless of caller. Higher is healthier.
/// Penalties stack: live blockers, the overdue share of dated work,
/// work-in-progress per person, and being behind the active sprint's ideal
/// burndown each shave points off a notional 100. (F3-16, computed on demand —
/// no daily snapshot job yet.)
/// </summary>
public static class HealthScoreCalculator
{
    public readonly record struct Inputs(
        int Blocked,
        int OpenWithDueDate,
        int Overdue,
        int InProgress,
        int TeamSize,
        bool SprintBehind);

    public static int Score(Inputs h)
    {
        double penalty = 0;

        // Each blocked task is a live impediment; cap so a pile of blockers
        // can't alone zero the score.
        penalty += Math.Min(30, h.Blocked * 10);

        // Overdue measured as a share of the dated, still-open work.
        if (h.OpenWithDueDate > 0)
            penalty += Math.Min(30, 30.0 * h.Overdue / h.OpenWithDueDate);

        // Too much in flight per person signals thrash; tolerate ~2/dev.
        var wipPerDev = h.TeamSize > 0 ? (double)h.InProgress / h.TeamSize : h.InProgress;
        penalty += Math.Clamp((wipPerDev - 2) * 5, 0d, 20d);

        if (h.SprintBehind) penalty += 20;

        return (int)Math.Round(Math.Clamp(100 - penalty, 0d, 100d));
    }

    public static string Band(int score) =>
        score >= 75 ? "Healthy" : score >= 50 ? "At risk" : "Critical";
}
