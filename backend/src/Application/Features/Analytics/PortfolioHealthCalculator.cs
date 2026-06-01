namespace Application.Features.Analytics;

/// <summary>
/// Pure, type-agnostic portfolio health score (0–100). Where the engineering
/// <see cref="HealthScoreCalculator"/> leans on blockers / WIP / sprint pace,
/// this scores from signals every project type exposes: total open work, the
/// overdue share of it, and the at-risk share (engineering blockers; other
/// types pass 0 today). Higher is healthier; a project with no open work is
/// fully healthy. Kept DB-free so the formula is unit-testable and identical
/// across the six project types.
/// </summary>
public static class PortfolioHealthCalculator
{
    public readonly record struct Inputs(int OpenItems, int Overdue, int AtRisk);

    public static int Score(Inputs i)
    {
        if (i.OpenItems <= 0) return 100;

        // Overdue dominates (work already past its date); at-risk is a smaller,
        // additive penalty. Each share is clamped to its own open-item ceiling
        // so a miscount can't push a single dimension past its weight.
        var overdueShare = (double)Math.Min(i.Overdue, i.OpenItems) / i.OpenItems;
        var atRiskShare = (double)Math.Min(i.AtRisk, i.OpenItems) / i.OpenItems;

        var penalty = 60.0 * overdueShare + 25.0 * atRiskShare;
        return (int)Math.Round(Math.Clamp(100 - penalty, 0d, 100d));
    }

    public static string Band(int score) =>
        score >= 75 ? "Healthy" : score >= 50 ? "At risk" : "Critical";

    /// <summary>A project counts against the org "at risk" rollup below this score.</summary>
    public const int AtRiskThreshold = 60;
}
