using Domain.Enums;

namespace Application.Features.Roadmap;

/// <summary>
/// Pure date / bucketing / tone logic behind the type-aware roadmap timeline
/// (F1.5-08). Every function is DB-free and takes <c>now</c> explicitly so the
/// rules are unit-testable (<c>TimelineCalculatorTests</c>). The query handler
/// only loads rows and hands them through here.
/// </summary>
public static class TimelineCalculator
{
    /// <summary>A calendar quarter, <c>[Start, End)</c>.</summary>
    public record QuarterSpan(string Label, DateTime Start, DateTime End);

    /// <summary>Deals (or any dated value) bucketed into one quarter.</summary>
    public record QuarterTotal(QuarterSpan Quarter, int Count, decimal Value);

    /// <summary>
    /// Rotating palette for lanes with no semantic colour (deal stages, queues,
    /// workflows). Keywords map to tokens on the frontend.
    /// </summary>
    public static readonly IReadOnlyList<string> LanePalette =
        ["info", "violet", "teal", "amber", "rose", "success"];

    public static string ToneForIndex(int index) =>
        LanePalette[((index % LanePalette.Count) + LanePalette.Count) % LanePalette.Count];

    /// <summary>
    /// The visible window: the span of every dated item plus <c>now</c> (so the
    /// today-line is always on screen), padded by <paramref name="padDays"/> on
    /// both sides. With no dates it falls back to <c>now − before … now + after</c>.
    /// All bounds are date-aligned (midnight).
    /// </summary>
    public static (DateTime From, DateTime To) Window(
        IEnumerable<DateTime> dates, DateTime now,
        int padDays = 7, int fallbackBeforeDays = 14, int fallbackAfterDays = 60)
    {
        var today = now.Date;
        DateTime? min = null, max = null;
        foreach (var d in dates)
        {
            var day = d.Date;
            if (min is null || day < min) min = day;
            if (max is null || day > max) max = day;
        }

        if (min is null || max is null)
            return (today.AddDays(-fallbackBeforeDays), today.AddDays(fallbackAfterDays));

        var lo = min.Value < today ? min.Value : today;
        var hi = max.Value > today ? max.Value : today;
        return (lo.AddDays(-padDays), hi.AddDays(padDays + 1));
    }

    /// <summary>
    /// Every calendar quarter overlapping <c>[from, to)</c>, oldest first. The
    /// first span starts at the quarter boundary on or before <paramref name="from"/>.
    /// </summary>
    public static IReadOnlyList<QuarterSpan> Quarters(DateTime from, DateTime to)
    {
        var result = new List<QuarterSpan>();
        if (to <= from) return result;

        var cursor = new DateTime(from.Year, ((from.Month - 1) / 3) * 3 + 1, 1, 0, 0, 0, from.Kind);
        while (cursor < to)
        {
            var next = cursor.AddMonths(3);
            var q = (cursor.Month - 1) / 3 + 1;
            result.Add(new QuarterSpan($"Q{q} {cursor.Year}", cursor, next));
            cursor = next;
        }
        return result;
    }

    /// <summary>Counts + sums dated values per quarter. Items outside every quarter are ignored.</summary>
    public static IReadOnlyList<QuarterTotal> QuarterTotals(
        IEnumerable<(DateTime At, decimal Value)> items, IReadOnlyList<QuarterSpan> quarters)
    {
        var counts = new int[quarters.Count];
        var values = new decimal[quarters.Count];
        foreach (var (at, value) in items)
        {
            for (var i = 0; i < quarters.Count; i++)
            {
                if (at >= quarters[i].Start && at < quarters[i].End)
                {
                    counts[i]++;
                    values[i] += value;
                    break;
                }
            }
        }
        return quarters.Select((q, i) => new QuarterTotal(q, counts[i], values[i])).ToList();
    }

    /// <summary>An open deal is flagged when its expected close date has passed.</summary>
    public static bool IsCloseOverdue(DateTime expectedClose, DateTime now) =>
        expectedClose.Date < now.Date;

    /// <summary>
    /// SLA marker tone: breached → danger (flagged), due within
    /// <paramref name="warnHours"/> → warning, otherwise the lane tone.
    /// </summary>
    public static (string Tone, bool Flagged) SlaTone(
        DateTime slaDueAt, DateTime now, string laneTone, int warnHours = 24)
    {
        if (slaDueAt < now) return ("danger", true);
        if (slaDueAt <= now.AddHours(warnHours)) return ("warning", false);
        return (laneTone, false);
    }

    /// <summary>
    /// Workflow-run tone: completed → success, skipped → neutral, a pending /
    /// in-progress run scheduled in the past → danger (flagged, overdue),
    /// otherwise → info (upcoming).
    /// </summary>
    public static (string Tone, bool Flagged) RunTone(
        WorkflowRunStatus status, DateTime scheduledFor, DateTime now) => status switch
    {
        WorkflowRunStatus.Completed => ("success", false),
        WorkflowRunStatus.Skipped => ("neutral", false),
        _ when scheduledFor < now => ("danger", true),
        _ => ("info", false),
    };

    /// <summary>
    /// Asset publish-date tone: published → success, past its publish date and
    /// not yet published → danger (flagged), otherwise → neutral (scheduled).
    /// </summary>
    public static (string Tone, bool Flagged) AssetTone(
        AssetStatus status, DateTime publishDate, DateTime now)
    {
        if (status == AssetStatus.Published) return ("success", false);
        if (status != AssetStatus.Archived && publishDate.Date < now.Date) return ("danger", true);
        return ("neutral", false);
    }

    /// <summary>Open task with a due date in the past → overdue.</summary>
    public static bool IsTaskOverdue(DateTime dueDate, DateTime now) => dueDate.Date < now.Date;

    /// <summary>Marketing channel → frontend tone keyword (<c>mkt-email</c> …).</summary>
    public static string ChannelTone(MarketingChannel channel) =>
        "mkt-" + channel.ToString().ToLowerInvariant();
}
