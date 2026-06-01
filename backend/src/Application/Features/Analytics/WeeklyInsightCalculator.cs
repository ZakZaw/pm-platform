namespace Application.Features.Analytics;

/// <summary>
/// Pure "insight of the week" selector. Given a handful of project signals it
/// picks the single most actionable observation and phrases it as a headline +
/// supporting detail + tone keyword, with a couple of factual highlight chips.
/// Deterministic and DB-free so the wording is unit-testable and identical
/// regardless of caller. There is no weekly background job yet, so "weekly"
/// here means "the current standout signal", recomputed live on each load —
/// this is the honest, computed replacement for the old sample insight card,
/// distinct from the LLM-narrated AI-Inbox suggestion.
/// </summary>
public static class WeeklyInsightCalculator
{
    public readonly record struct Inputs(
        bool HasActiveSprint,
        string? SprintName,
        int Committed,
        int DonePoints,
        int ElapsedDays,
        int SprintLengthDays,
        int BlockedPoints,
        int BlockedTaskCount,
        string? TopBlockerTitle,
        int OverdueTaskCount,
        string? BusiestMemberName,
        int BusiestMemberWip,
        int OpenTaskCount);

    public record Insight(string Headline, string Detail, string Tone, IReadOnlyList<string> Highlights);

    // A member with this many tasks in flight is a load watch-out worth calling out.
    private const int WipWatchThreshold = 4;

    public static Insight Compute(Inputs i)
    {
        var highlights = BuildHighlights(i);

        if (i.HasActiveSprint)
        {
            var length = Math.Max(1, i.SprintLengthDays);
            var elapsed = Math.Clamp(i.ElapsedDays, 0, length);
            var remainingDays = length - elapsed;
            var name = string.IsNullOrWhiteSpace(i.SprintName) ? "this sprint" : i.SprintName!;

            // Project end-of-sprint completion from the pace observed so far.
            // Before any day has elapsed there's no pace to extrapolate, so we
            // don't cry "miss" on day zero.
            if (elapsed > 0 && i.Committed > 0)
            {
                var pace = (double)i.DonePoints / elapsed;            // points/day
                var projectedDone = i.DonePoints + pace * remainingDays;
                var shortfall = i.Committed - projectedDone;
                if (shortfall >= 3)
                {
                    var pts = (int)Math.Round(shortfall);
                    var tone = shortfall >= i.Committed * 0.25 ? "danger" : "warning";
                    var detail = i.BlockedPoints > 0
                        ? $"At the current pace of {pace:0.#} pt/day, ~{pts} of {i.Committed} committed pt won't land by the deadline. {i.BlockedPoints} pt are blocked — clearing those first recovers the most ground."
                        : $"At the current pace of {pace:0.#} pt/day, ~{pts} of {i.Committed} committed pt won't land by the deadline. Trim scope or pull in help to stay on commitment.";
                    return new Insight($"Likely to miss {name} by ~{pts} pt", detail, tone, highlights);
                }
            }

            if (i.BlockedPoints > 0)
            {
                var detail = string.IsNullOrWhiteSpace(i.TopBlockerTitle)
                    ? $"{i.BlockedPoints} pt across {i.BlockedTaskCount} task{Plural(i.BlockedTaskCount)} are blocked and idle while the sprint clock runs."
                    : $"{i.BlockedPoints} pt across {i.BlockedTaskCount} task{Plural(i.BlockedTaskCount)} are blocked — starting with “{i.TopBlockerTitle}” unblocks the most points.";
                return new Insight($"{i.BlockedPoints} pt blocked in {name}", detail, "warning", highlights);
            }

            var detailOk = $"{i.DonePoints} of {i.Committed} pt done with {remainingDays} day{Plural(remainingDays)} left — tracking at or ahead of the ideal line.";
            if (i.BusiestMemberName is not null && i.BusiestMemberWip >= WipWatchThreshold)
                detailOk += $" Keep an eye on {i.BusiestMemberName}'s load ({i.BusiestMemberWip} in flight).";
            return new Insight($"{name} is on track", detailOk, "success", highlights);
        }

        // No active sprint.
        if (i.OpenTaskCount == 0)
            return new Insight(
                "Nothing open right now",
                "No active sprint and no open tasks — a good moment to plan the next one.",
                "info", highlights);

        if (i.OverdueTaskCount > 0)
            return new Insight(
                $"{i.OverdueTaskCount} task{Plural(i.OverdueTaskCount)} overdue",
                $"There's no active sprint and {i.OverdueTaskCount} open task{Plural(i.OverdueTaskCount)} {(i.OverdueTaskCount == 1 ? "is" : "are")} past due. Start a sprint or reschedule to regain a deadline.",
                "warning", highlights);

        return new Insight(
            "No active sprint",
            $"{i.OpenTaskCount} open task{Plural(i.OpenTaskCount)} sitting in the backlog. Start a sprint to put a deadline on them.",
            "info", highlights);
    }

    private static IReadOnlyList<string> BuildHighlights(Inputs i)
    {
        var list = new List<string>();
        if (i.BlockedTaskCount > 0) list.Add($"{i.BlockedTaskCount} blocked");
        if (i.OverdueTaskCount > 0) list.Add($"{i.OverdueTaskCount} overdue");
        if (i.BusiestMemberName is not null && i.BusiestMemberWip >= WipWatchThreshold)
            list.Add($"{i.BusiestMemberName} · {i.BusiestMemberWip} WIP");
        return list;
    }

    private static string Plural(int n) => n == 1 ? "" : "s";
}
