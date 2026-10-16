using Application.Features.Roadmap;
using Domain.Enums;

namespace Unit;

public class TimelineCalculatorTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Window_NoDates_FallsBackAroundToday()
    {
        var (from, to) = TimelineCalculator.Window([], Now, padDays: 7, fallbackBeforeDays: 14, fallbackAfterDays: 60);

        Assert.Equal(new DateTime(2026, 10, 2), from.Date);
        Assert.Equal(new DateTime(2026, 12, 15), to.Date);
    }

    [Fact]
    public void Window_PadsDataSpanAndAlwaysIncludesToday()
    {
        // All data in the future — the window still starts at (today − pad).
        var (from, to) = TimelineCalculator.Window(
            [new DateTime(2026, 11, 1), new DateTime(2026, 11, 20)], Now, padDays: 7);

        Assert.Equal(new DateTime(2026, 10, 9), from);
        // max day + pad + 1 (inclusive end of the last day).
        Assert.Equal(new DateTime(2026, 11, 28), to);
    }

    [Fact]
    public void Window_PastData_ExtendsBackwards()
    {
        var (from, to) = TimelineCalculator.Window([new DateTime(2026, 9, 1)], Now, padDays: 0);

        Assert.Equal(new DateTime(2026, 9, 1), from);
        Assert.Equal(new DateTime(2026, 10, 17), to);
    }

    [Fact]
    public void Quarters_AlignToQuarterBoundaries()
    {
        var qs = TimelineCalculator.Quarters(new DateTime(2026, 8, 15), new DateTime(2027, 1, 10));

        Assert.Equal(["Q3 2026", "Q4 2026", "Q1 2027"], qs.Select(q => q.Label));
        Assert.Equal(new DateTime(2026, 7, 1), qs[0].Start);
        Assert.Equal(new DateTime(2026, 10, 1), qs[0].End);
        Assert.Equal(new DateTime(2027, 4, 1), qs[^1].End);
    }

    [Fact]
    public void Quarters_EmptyWhenRangeInverted() =>
        Assert.Empty(TimelineCalculator.Quarters(new DateTime(2026, 5, 1), new DateTime(2026, 4, 1)));

    [Fact]
    public void QuarterTotals_BucketsCountAndValue_IgnoringOutOfRange()
    {
        var qs = TimelineCalculator.Quarters(new DateTime(2026, 7, 1), new DateTime(2026, 12, 31));
        var totals = TimelineCalculator.QuarterTotals(
        [
            (new DateTime(2026, 7, 5), 1_000m),
            (new DateTime(2026, 9, 30), 2_000m),
            (new DateTime(2026, 10, 1), 500m),   // first day of Q4
            (new DateTime(2027, 2, 1), 9_999m),  // outside every quarter
        ], qs);

        Assert.Equal(2, totals[0].Count);
        Assert.Equal(3_000m, totals[0].Value);
        Assert.Equal(1, totals[1].Count);
        Assert.Equal(500m, totals[1].Value);
    }

    [Fact]
    public void ToneForIndex_CyclesPalette()
    {
        var n = TimelineCalculator.LanePalette.Count;
        Assert.Equal(TimelineCalculator.ToneForIndex(0), TimelineCalculator.ToneForIndex(n));
        Assert.Equal(TimelineCalculator.LanePalette[1], TimelineCalculator.ToneForIndex(1));
    }

    [Fact]
    public void IsCloseOverdue_ComparesByDay()
    {
        Assert.False(TimelineCalculator.IsCloseOverdue(new DateTime(2026, 10, 16, 1, 0, 0), Now));
        Assert.True(TimelineCalculator.IsCloseOverdue(new DateTime(2026, 10, 15), Now));
    }

    [Fact]
    public void SlaTone_BreachedWarningOrLane()
    {
        Assert.Equal(("danger", true), TimelineCalculator.SlaTone(Now.AddMinutes(-1), Now, "teal"));
        Assert.Equal(("warning", false), TimelineCalculator.SlaTone(Now.AddHours(5), Now, "teal"));
        Assert.Equal(("teal", false), TimelineCalculator.SlaTone(Now.AddDays(3), Now, "teal"));
    }

    [Theory]
    [InlineData(WorkflowRunStatus.Completed, -2, "success", false)]
    [InlineData(WorkflowRunStatus.Skipped, -2, "neutral", false)]
    [InlineData(WorkflowRunStatus.Pending, -2, "danger", true)]
    [InlineData(WorkflowRunStatus.InProgress, -2, "danger", true)]
    [InlineData(WorkflowRunStatus.Pending, 2, "info", false)]
    public void RunTone_ByStatusAndSchedule(WorkflowRunStatus status, int offsetDays, string tone, bool flagged) =>
        Assert.Equal((tone, flagged), TimelineCalculator.RunTone(status, Now.AddDays(offsetDays), Now));

    [Fact]
    public void AssetTone_PublishedOverdueOrScheduled()
    {
        Assert.Equal(("success", false), TimelineCalculator.AssetTone(AssetStatus.Published, Now.AddDays(-3), Now));
        Assert.Equal(("danger", true), TimelineCalculator.AssetTone(AssetStatus.Review, Now.AddDays(-3), Now));
        Assert.Equal(("neutral", false), TimelineCalculator.AssetTone(AssetStatus.Draft, Now.AddDays(3), Now));
    }

    [Fact]
    public void ChannelTone_MapsToMarketingTokenKeyword() =>
        Assert.Equal("mkt-email", TimelineCalculator.ChannelTone(MarketingChannel.Email));
}
