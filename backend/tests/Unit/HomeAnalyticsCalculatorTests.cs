using Application.Features.Analytics;

namespace Unit;

public class TrendCalculatorTests
{
    [Fact]
    public void PercentChange_ComputesWholePercent() =>
        Assert.Equal(50.0, TrendCalculator.PercentChange(15, 10));

    [Fact]
    public void PercentChange_NoBaseline_IsNull() =>
        Assert.Null(TrendCalculator.PercentChange(5, 0));

    [Fact]
    public void TrailingWindows_SplitsLastAndPreviousWindow()
    {
        var (current, previous) = TrendCalculator.TrailingWindows([1, 2, 3, 4, 10, 20], 2);
        Assert.Equal(15.0, current);
        Assert.Equal(3.5, previous);
    }

    [Fact]
    public void TrailingWindows_ShortSeries_HasNoPrevious()
    {
        var (current, previous) = TrendCalculator.TrailingWindows([4, 6], 5);
        Assert.Equal(5.0, current);
        Assert.Null(previous);
    }

    [Fact]
    public void TrailingWindows_Empty_IsAllNull()
    {
        var (current, previous) = TrendCalculator.TrailingWindows([], 3);
        Assert.Null(current);
        Assert.Null(previous);
    }
}

public class WeeklySumTests
{
    [Fact]
    public void WeeklySum_SumsValuesPerMondayWeek()
    {
        var asOf = new DateTime(2026, 10, 14); // Wednesday
        var weeks = ThroughputCalculator.WeeklySum(
        [
            (new DateTime(2026, 10, 12), 3),  // this week (Mon)
            (new DateTime(2026, 10, 14), 5),  // this week
            (new DateTime(2026, 10, 9), 2),   // last week (Fri)
            (new DateTime(2026, 9, 1), 99),   // outside window
        ], asOf, 3);

        Assert.Equal(3, weeks.Count);
        Assert.Equal(new DateTime(2026, 9, 28), weeks[0].WeekStart);
        Assert.Equal(0, weeks[0].Total);
        Assert.Equal(2, weeks[1].Total);
        Assert.Equal(8, weeks[2].Total);
    }
}

public class OpenBacklogCalculatorTests
{
    private static readonly DateTime AsOf = new(2026, 10, 14, 12, 0, 0); // Wednesday

    [Fact]
    public void Weekly_CountsItemsOpenAtEachWeekEnd()
    {
        var series = OpenBacklogCalculator.Weekly(
        [
            new(new DateTime(2026, 9, 1), null, 1),                       // open throughout
            new(new DateTime(2026, 10, 1), new DateTime(2026, 10, 8), 1), // open only at end of week of Sep 29
            new(new DateTime(2026, 10, 13), null, 1),                     // opened this week
        ], AsOf, 3);

        // Week ends: Oct 5 (Mon 00:00), Oct 12, and "now" for the current week.
        Assert.Equal([2m, 1m, 2m], series);
    }

    [Fact]
    public void Weekly_SumsWeights()
    {
        var series = OpenBacklogCalculator.Weekly(
        [
            new(new DateTime(2026, 9, 1), null, 1000m),
            new(new DateTime(2026, 9, 1), null, 250m),
        ], AsOf, 1);

        Assert.Equal([1250m], series);
    }

    [Fact]
    public void Weekly_NoItems_IsAllZero() =>
        Assert.All(OpenBacklogCalculator.Weekly([], AsOf, 4), v => Assert.Equal(0m, v));
}

public class DisplayFormatTests
{
    [Theory]
    [InlineData(1_260_000, "USD", "$1.3M")]
    [InlineData(14_200, "EUR", "€14.2k")]
    [InlineData(850, "GBP", "£850")]
    [InlineData(0, "USD", "$0")]
    [InlineData(5_000, "CHF", "CHF 5k")]
    public void Money_IsCompact(decimal value, string currency, string expected) =>
        Assert.Equal(expected, DisplayFormat.Money(value, currency));

    [Theory]
    [InlineData(0.5, "30m")]
    [InlineData(3.2, "3.2h")]
    [InlineData(50, "2.1d")]
    public void Duration_PicksUnit(double hours, string expected) =>
        Assert.Equal(expected, DisplayFormat.Duration(hours));

    [Theory]
    [InlineData(3, "+3")]
    [InlineData(-0.4, "-0.4")]
    [InlineData(0, "±0")]
    public void Signed_HasExplicitSign(double value, string expected) =>
        Assert.Equal(expected, DisplayFormat.Signed(value));
}

public class CycleTimeHoursTests
{
    [Fact]
    public void AverageHours_IgnoresInvertedSpans()
    {
        var start = new DateTime(2026, 10, 1, 9, 0, 0);
        var avg = CycleTimeCalculator.AverageHours(
        [
            (start, start.AddHours(2)),
            (start, start.AddHours(4)),
            (start, start.AddHours(-1)),
        ]);
        Assert.Equal(3.0, avg);
    }

    [Fact]
    public void AverageHours_Empty_IsNull() =>
        Assert.Null(CycleTimeCalculator.AverageHours([]));
}

public class PersonalPerformanceCalculatorTests
{
    private static readonly DateTime Today = new(2026, 10, 16);

    [Fact]
    public void Streak_CountsConsecutiveDaysEndingToday()
    {
        var streak = PersonalPerformanceCalculator.CurrentStreak(
            [Today.AddHours(10), Today.AddDays(-1), Today.AddDays(-1).AddHours(3), Today.AddDays(-2), Today.AddDays(-4)],
            Today);
        Assert.Equal(3, streak);
    }

    [Fact]
    public void Streak_NothingToday_CountsFromYesterday()
    {
        var streak = PersonalPerformanceCalculator.CurrentStreak(
            [Today.AddDays(-1), Today.AddDays(-2)], Today);
        Assert.Equal(2, streak);
    }

    [Fact]
    public void Streak_Broken_IsZero() =>
        Assert.Equal(0, PersonalPerformanceCalculator.CurrentStreak([Today.AddDays(-3)], Today));

    [Fact]
    public void Streak_NoCompletions_IsZero() =>
        Assert.Equal(0, PersonalPerformanceCalculator.CurrentStreak([], Today));

    [Theory]
    [InlineData(0, 0, 0, "Clear", "neutral")]
    [InlineData(10, 0, 0, "On track", "success")]
    [InlineData(10, 5, 0, "At risk", "warning")]
    [InlineData(4, 4, 4, "Behind", "danger")]
    public void StatusFor_MapsPortfolioScore(int open, int overdue, int blocked, string label, string tone)
    {
        var status = PersonalPerformanceCalculator.StatusFor(open, overdue, blocked);
        Assert.Equal(label, status.Label);
        Assert.Equal(tone, status.Tone);
    }

    private static PersonalPerformanceCalculator.InsightInputs Inputs(
        int completed = 10, int prev = 10, int open = 5, int overdue = 0, int blocked = 0,
        int streak = 0, double? cycle = null, double? cyclePrev = null) =>
        new(completed, prev, open, overdue, blocked, overdue > 0 ? "Fix login" : null, streak, cycle, cyclePrev);

    [Fact]
    public void Insight_OverdueWinsAndNamesTheOldest()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(overdue: 2, blocked: 1));
        Assert.Equal("warning", i.Tone);
        Assert.Equal("2 items past due", i.Headline);
        Assert.Contains("Fix login", i.Detail);
        Assert.Contains("2 overdue", i.Highlights);
        Assert.Contains("1 blocked", i.Highlights);
    }

    [Fact]
    public void Insight_BlockedWhenNothingOverdue()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(blocked: 1));
        Assert.Equal("1 item blocked", i.Headline);
        Assert.Equal("warning", i.Tone);
    }

    [Fact]
    public void Insight_ThroughputUp_MentionsCycleImprovement()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(completed: 12, prev: 10, cycle: 2, cyclePrev: 3));
        Assert.Equal("success", i.Tone);
        Assert.Equal("You shipped 20% more than the previous 30 days", i.Headline);
        Assert.Contains("3d to 2d", i.Detail);
    }

    [Fact]
    public void Insight_ThroughputDown_IsInfo()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(completed: 5, prev: 10));
        Assert.Equal("info", i.Tone);
        Assert.StartsWith("Throughput down 50%", i.Headline);
    }

    [Fact]
    public void Insight_LongStreak_IsCalledOut()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(streak: 6));
        Assert.Equal("6-day completion streak", i.Headline);
    }

    [Fact]
    public void Insight_EmptyAccount_IsFriendly()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs(completed: 0, prev: 0, open: 0));
        Assert.Equal("Nothing on your plate yet", i.Headline);
        Assert.Empty(i.Highlights);
    }

    [Fact]
    public void Insight_SteadyPace_Default()
    {
        var i = PersonalPerformanceCalculator.Insight(Inputs());
        Assert.Equal("Steady pace", i.Headline);
        Assert.Equal("success", i.Tone);
    }
}

public class ProjectHomeCalculatorTests
{
    private static readonly DateTime Now = new(2026, 10, 16, 9, 0, 0);

    [Fact]
    public void Engineering_NoSprintNoHistory_RendersDashes()
    {
        var tiles = ProjectHomeCalculator.Engineering(new(null, null, null, null, 0, 0, 0, 0));
        Assert.Equal(["Sprint", "Velocity", "Bugs open", "PRs open"], tiles.Select(t => t.Label));
        Assert.Equal("—", tiles[0].Value);
        Assert.Equal("No active sprint", tiles[0].Sub);
        Assert.Equal("—", tiles[1].Value);
        Assert.Null(tiles[1].Delta);
        Assert.Equal("0", tiles[2].Value);
    }

    [Fact]
    public void Engineering_WithData_FormatsVelocityDelta()
    {
        var tiles = ProjectHomeCalculator.Engineering(new("Sprint 12", 4, 31.3, -8, 7, 2, 5, 1));
        Assert.Equal("Sprint 12", tiles[0].Value);
        Assert.Equal("4d left", tiles[0].Sub);
        Assert.Equal("31.3", tiles[1].Value);
        Assert.Equal("-8%", tiles[1].Delta);
        Assert.False(tiles[1].DeltaGood);
        Assert.Equal("2 urgent", tiles[2].Sub);
        Assert.Equal("1 failing CI", tiles[3].Sub);
    }

    [Fact]
    public void Sales_SubstitutesForecastForQuota()
    {
        var tiles = ProjectHomeCalculator.Sales(new("USD", 1_260_000m, 10, 34, 17, 33, 21, 480_000m));
        Assert.Equal(["Pipeline", "Win rate", "Avg cycle", "Forecast"], tiles.Select(t => t.Label));
        Assert.Equal("$1.3M", tiles[0].Value);
        Assert.Equal("34%", tiles[1].Value);
        Assert.Equal("21d", tiles[2].Value);
        Assert.Equal("$480k", tiles[3].Value);
    }

    [Fact]
    public void Sales_Empty_NoNaN()
    {
        var tiles = ProjectHomeCalculator.Sales(new("USD", 0, 0, null, 0, 0, null, 0));
        Assert.Equal("$0", tiles[0].Value);
        Assert.Equal("—", tiles[1].Value);
        Assert.Equal("nothing closed in 90d", tiles[1].Sub);
        Assert.Equal("—", tiles[2].Value);
    }

    [Fact]
    public void Support_SubstitutesBreachedForCsat()
    {
        var tiles = ProjectHomeCalculator.Support(new(28, 4, 94.2, 120, 3, 0.2));
        Assert.Equal(["Open", "SLA hit", "Breached", "Avg first reply"], tiles.Select(t => t.Label));
        Assert.Equal("94%", tiles[1].Value);
        Assert.Equal("3", tiles[2].Value);
        Assert.Equal("12m", tiles[3].Value);
    }

    [Fact]
    public void Marketing_PublishedDelta_OnlyWithBaseline()
    {
        var withData = ProjectHomeCalculator.Marketing(new(4, 2, 15, 12, 9, 3));
        Assert.Equal(["Campaigns", "Scheduled", "Published", "In review"], withData.Select(t => t.Label));
        Assert.Equal("+3", withData[2].Delta);
        Assert.True(withData[2].DeltaGood);

        var empty = ProjectHomeCalculator.Marketing(new(0, 0, 0, 0, 0, 0));
        Assert.Null(empty[2].Delta);
    }

    [Fact]
    public void Operations_NextRunAndCycle()
    {
        var tiles = ProjectHomeCalculator.Operations(new(6, 1, 92.5, 40, Now.AddDays(2), "Backup check", 3.5, Now));
        Assert.Equal(["Active runs", "Completion", "Next run", "Avg cycle"], tiles.Select(t => t.Label));
        Assert.Equal("1 overdue", tiles[0].Sub);
        Assert.Equal("93%", tiles[1].Value);
        Assert.Equal("Oct 18", tiles[2].Value);
        Assert.Equal("Backup check · in 2d", tiles[2].Sub);
        Assert.Equal("3.5h", tiles[3].Value);
    }

    [Fact]
    public void Operations_Empty_RendersDashes()
    {
        var tiles = ProjectHomeCalculator.Operations(new(0, 0, null, 0, null, null, null, Now));
        Assert.Equal("—", tiles[1].Value);
        Assert.Equal("—", tiles[2].Value);
        Assert.Equal("nothing scheduled", tiles[2].Sub);
        Assert.Equal("—", tiles[3].Value);
    }

    [Fact]
    public void Generic_CountsAreReal()
    {
        var tiles = ProjectHomeCalculator.Generic(new(12, 3, 5, 4));
        Assert.Equal(["12", "3", "5", "4"], tiles.Select(t => t.Value));
    }

    [Fact]
    public void SalesNote_PrioritisesOverdueCloses()
    {
        var note = ProjectHomeCalculator.SalesNote(10, 2, 1, 40);
        Assert.Equal("Pipeline health", note.Title);
        Assert.Equal("1 deal past expected close", note.Headline);
        Assert.Equal("warning", note.Tone);
        Assert.Equal(new[] { "2 at risk", "1 past close date" }, note.Highlights);
    }

    [Fact]
    public void SalesNote_EmptyPipeline_IsInfo() =>
        Assert.Equal("No open deals", ProjectHomeCalculator.SalesNote(0, 0, 0, null).Headline);

    [Fact]
    public void SupportNote_BreachIsDanger()
    {
        var note = ProjectHomeCalculator.SupportNote(20, 3, 2, 90);
        Assert.Equal("danger", note.Tone);
        Assert.Equal("3 tickets past SLA", note.Headline);
    }

    [Fact]
    public void SupportNote_ClearQueue() =>
        Assert.Equal("Queue is clear", ProjectHomeCalculator.SupportNote(0, 0, 0, null).Headline);

    [Fact]
    public void MarketingNote_OverdueFirst()
    {
        Assert.Equal("2 assets past publish date", ProjectHomeCalculator.MarketingNote(2, 3, 1, 4).Headline);
        Assert.Equal("3 assets due this week", ProjectHomeCalculator.MarketingNote(0, 3, 1, 4).Headline);
        Assert.Equal("No active campaigns", ProjectHomeCalculator.MarketingNote(0, 0, 0, 0).Headline);
    }

    [Fact]
    public void OperationsNote_Branches()
    {
        Assert.Equal("danger", ProjectHomeCalculator.OperationsNote(2, 3, 95).Tone);
        Assert.Equal("Completion at 60%", ProjectHomeCalculator.OperationsNote(0, 3, 60).Headline);
        Assert.Equal("Nothing due this week", ProjectHomeCalculator.OperationsNote(0, 0, null).Headline);
        Assert.Equal("All runs on track", ProjectHomeCalculator.OperationsNote(0, 2, 100).Headline);
    }
}
