namespace Application.Features.Analytics;

/// <summary>
/// Pure personal-dashboard math for the /home page: the completion streak, the
/// per-project status read-out, and the personal "weekly insight" — the single
/// most useful observation about one person's own work. DB-free and
/// deterministic so the wording and thresholds are unit-testable.
/// </summary>
public static class PersonalPerformanceCalculator
{
    /// <summary>
    /// Consecutive calendar days, ending today, with at least one completion.
    /// If nothing has been completed yet today the streak counts back from
    /// yesterday instead, so it doesn't read 0 every morning.
    /// </summary>
    public static int CurrentStreak(IEnumerable<DateTime> completions, DateTime today)
    {
        var days = completions.Select(d => d.Date).ToHashSet();
        var cursor = today.Date;
        if (!days.Contains(cursor)) cursor = cursor.AddDays(-1);

        var streak = 0;
        while (days.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }
        return streak;
    }

    public record ProjectStatus(string Label, string Tone);

    /// <summary>
    /// Personal per-project status from one person's open work there, using the
    /// same type-agnostic scoring as the portfolio. Nothing open = "Clear".
    /// </summary>
    public static ProjectStatus StatusFor(int open, int overdue, int blocked)
    {
        if (open <= 0) return new("Clear", "neutral");
        var score = PortfolioHealthCalculator.Score(new(open, overdue, blocked));
        return score >= 75 ? new("On track", "success")
            : score >= 50 ? new("At risk", "warning")
            : new("Behind", "danger");
    }

    public readonly record struct InsightInputs(
        int Completed30,
        int CompletedPrev30,
        int OpenItems,
        int OverdueItems,
        int BlockedItems,
        string? TopOverdueTitle,
        int StreakDays,
        double? CycleDays,
        double? CyclePrevDays);

    // A swing of this many percent in throughput is worth calling out.
    private const double ThroughputSwingPct = 15;
    private const int StreakCallout = 5;

    public static WeeklyInsightCalculator.Insight Insight(InsightInputs i)
    {
        var highlights = new List<string>();
        if (i.OverdueItems > 0) highlights.Add($"{i.OverdueItems} overdue");
        if (i.BlockedItems > 0) highlights.Add($"{i.BlockedItems} blocked");
        if (i.StreakDays >= 2) highlights.Add($"{i.StreakDays}-day streak");

        var change = TrendCalculator.PercentChange(i.Completed30, i.CompletedPrev30);

        // 1. Overdue work is the most actionable thing on anyone's plate.
        if (i.OverdueItems > 0)
        {
            var lead = string.IsNullOrWhiteSpace(i.TopOverdueTitle)
                ? "Clear or reschedule them first"
                : $"Start with “{i.TopOverdueTitle}”";
            return new($"{i.OverdueItems} item{Plural(i.OverdueItems)} past due",
                $"{i.OverdueItems} of your {i.OpenItems} open item{Plural(i.OpenItems)} {(i.OverdueItems == 1 ? "is" : "are")} past {(i.OverdueItems == 1 ? "its" : "their")} due date. {lead} so the rest of your plan stays honest.",
                "warning", highlights);
        }

        // 2. Blocked work idles silently.
        if (i.BlockedItems > 0)
            return new($"{i.BlockedItems} item{Plural(i.BlockedItems)} blocked",
                $"{i.BlockedItems} of your open item{Plural(i.OpenItems)} {(i.BlockedItems == 1 ? "is" : "are")} blocked. A quick nudge to whoever holds the dependency usually unblocks the most.",
                "warning", highlights);

        // 3. Throughput trend vs the previous 30 days.
        if (change is { } up && up >= ThroughputSwingPct)
        {
            var cycle = i.CycleDays is { } c && i.CyclePrevDays is { } p && c < p
                ? $" Your cycle time also dropped from {p:0.#}d to {c:0.#}d."
                : "";
            return new($"You shipped {up:0}% more than the previous 30 days",
                $"{i.Completed30} items completed vs {i.CompletedPrev30} the 30 days before.{cycle}",
                "success", highlights);
        }
        if (change is { } down && down <= -ThroughputSwingPct)
            return new($"Throughput down {Math.Abs(down):0}% on the previous 30 days",
                $"{i.Completed30} items completed vs {i.CompletedPrev30} the 30 days before. If you're stuck on something large, splitting it keeps work flowing.",
                "info", highlights);

        if (i.StreakDays >= StreakCallout)
            return new($"{i.StreakDays}-day completion streak",
                $"You've closed something every day for {i.StreakDays} days. {i.OpenItems} open item{Plural(i.OpenItems)} left on your plate.",
                "success", highlights);

        if (i.Completed30 == 0 && i.OpenItems == 0)
            return new("Nothing on your plate yet",
                "Nothing assigned to you and nothing completed in the last 30 days. Pick something up from a project backlog to get started.",
                "info", highlights);

        if (i.Completed30 == 0)
            return new("No completions in the last 30 days",
                $"You have {i.OpenItems} open item{Plural(i.OpenItems)}. Finishing a small one first gets things moving.",
                "info", highlights);

        return new("Steady pace",
            $"{i.Completed30} item{Plural(i.Completed30)} completed in the last 30 days, {i.OpenItems} still open — nothing overdue or blocked.",
            "success", highlights);
    }

    private static string Plural(int n) => n == 1 ? "" : "s";
}
