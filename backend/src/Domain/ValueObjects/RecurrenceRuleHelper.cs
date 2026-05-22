using System.Globalization;

namespace Domain.ValueObjects;

/// <summary>
/// Minimal RRULE parser supporting the subset needed by Operations
/// workflows: <c>FREQ=DAILY|WEEKLY|MONTHLY</c> with optional <c>INTERVAL=N</c>.
/// Enough for "daily check-in", "weekly review", "monthly compliance scan";
/// not a general-purpose iCalendar implementation. Replace with a library
/// (Ical.Net) when we need BYDAY/BYMONTHDAY/UNTIL/COUNT.
/// </summary>
public static class RecurrenceRuleHelper
{
    public enum Frequency { Daily, Weekly, Monthly }

    public readonly record struct Parsed(Frequency Freq, int Interval);

    public static bool TryParse(string? rule, out Parsed parsed)
    {
        parsed = default;
        if (string.IsNullOrWhiteSpace(rule)) return false;

        Frequency? freq = null;
        var interval = 1;
        foreach (var raw in rule.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var part = raw.Trim();
            var eq = part.IndexOf('=');
            if (eq <= 0) continue;
            var key = part[..eq].Trim().ToUpperInvariant();
            var val = part[(eq + 1)..].Trim().ToUpperInvariant();
            switch (key)
            {
                case "FREQ":
                    freq = val switch
                    {
                        "DAILY" => Frequency.Daily,
                        "WEEKLY" => Frequency.Weekly,
                        "MONTHLY" => Frequency.Monthly,
                        _ => null
                    };
                    if (freq is null) return false;
                    break;
                case "INTERVAL":
                    if (!int.TryParse(val, NumberStyles.Integer, CultureInfo.InvariantCulture, out interval)
                        || interval < 1) return false;
                    break;
                // Unknown parts are ignored — keeps us forward-compatible with
                // rules that include UNTIL/BYDAY/etc. as long as FREQ parses.
            }
        }

        if (freq is null) return false;
        parsed = new Parsed(freq.Value, interval);
        return true;
    }

    /// <summary>
    /// Returns every occurrence of <paramref name="rule"/> strictly after
    /// <paramref name="lastScheduled"/> up to and including
    /// <paramref name="horizon"/>. If the rule doesn't parse, returns
    /// an empty sequence so callers degrade gracefully.
    /// </summary>
    public static IEnumerable<DateTime> Occurrences(
        string? rule,
        DateTime lastScheduled,
        DateTime horizon)
    {
        if (!TryParse(rule, out var p)) yield break;
        if (horizon <= lastScheduled) yield break;

        var next = lastScheduled;
        // Cap the loop so a misconfigured rule (interval=1, horizon far away)
        // can't blow up. One year of daily occurrences = 365 — plenty headroom.
        for (var i = 0; i < 400; i++)
        {
            next = p.Freq switch
            {
                Frequency.Daily => next.AddDays(p.Interval),
                Frequency.Weekly => next.AddDays(7 * p.Interval),
                Frequency.Monthly => next.AddMonths(p.Interval),
                _ => next.AddDays(1),
            };
            if (next > horizon) yield break;
            yield return next;
        }
    }
}
