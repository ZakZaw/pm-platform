using Application.Features.Analytics;

namespace Unit;

public class HealthScoreCalculatorTests
{
    [Fact]
    public void CleanProject_ScoresPerfect()
    {
        var score = HealthScoreCalculator.Score(new(0, 0, 0, 0, 5, false));
        Assert.Equal(100, score);
        Assert.Equal("Healthy", HealthScoreCalculator.Band(score));
    }

    [Fact]
    public void Blockers_CapPenaltyAt30()
    {
        // 10 blockers would be 100 pts uncapped; the cap holds it to 30.
        var score = HealthScoreCalculator.Score(new(10, 0, 0, 0, 5, false));
        Assert.Equal(70, score);
    }

    [Fact]
    public void OverdueRatio_ScalesPenalty()
    {
        // Half of the dated, open work overdue → 15 of the 30 overdue points.
        var score = HealthScoreCalculator.Score(new(0, 10, 5, 0, 5, false));
        Assert.Equal(85, score);
    }

    [Fact]
    public void HighWip_AndBehindSprint_StackPenalties()
    {
        // 5 devs, 20 in progress → 4/dev → (4-2)*5 = 10 WIP penalty.
        // Behind sprint adds 20. 100 - 30 = 70.
        var score = HealthScoreCalculator.Score(new(0, 0, 0, 20, 5, true));
        Assert.Equal(70, score);
    }

    [Theory]
    [InlineData(80, "Healthy")]
    [InlineData(60, "At risk")]
    [InlineData(30, "Critical")]
    public void Band_ReflectsScore(int score, string band) =>
        Assert.Equal(band, HealthScoreCalculator.Band(score));
}

public class CycleTimeCalculatorTests
{
    private static readonly DateTime T0 = new(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void NoSpans_ReturnsNull() =>
        Assert.Null(CycleTimeCalculator.AverageDays([]));

    [Fact]
    public void AveragesSpanLengthsInDays()
    {
        var spans = new[] { (T0, T0.AddDays(2)), (T0, T0.AddDays(4)) };
        Assert.Equal(3.0, CycleTimeCalculator.AverageDays(spans));
    }

    [Fact]
    public void IgnoresOutOfOrderSpans()
    {
        var spans = new[]
        {
            (T0, T0.AddDays(2)),
            (T0.AddDays(5), T0), // end before start — dropped
        };
        Assert.Equal(2.0, CycleTimeCalculator.AverageDays(spans));
    }
}

public class WeeklyInsightCalculatorTests
{
    // A sprint half-way through with only a quarter of its points done is
    // pacing to miss; the headline calls the shortfall and goes danger when
    // the gap is a big share of the commitment.
    [Fact]
    public void BehindPace_FlagsProjectedMiss()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: true, SprintName: "Sprint 7",
            Committed: 40, DonePoints: 10, ElapsedDays: 5, SprintLengthDays: 10,
            BlockedPoints: 0, BlockedTaskCount: 0, TopBlockerTitle: null,
            OverdueTaskCount: 0, BusiestMemberName: null, BusiestMemberWip: 0,
            OpenTaskCount: 20));

        // pace 2 pt/day × 5 remaining days = 10 more → 20 done, 20 short.
        Assert.Contains("miss Sprint 7 by ~20 pt", insight.Headline);
        Assert.Equal("danger", insight.Tone);
    }

    [Fact]
    public void OnDayZero_DoesNotProjectMiss()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: true, SprintName: "Sprint 7",
            Committed: 40, DonePoints: 0, ElapsedDays: 0, SprintLengthDays: 10,
            BlockedPoints: 0, BlockedTaskCount: 0, TopBlockerTitle: null,
            OverdueTaskCount: 0, BusiestMemberName: null, BusiestMemberWip: 0,
            OpenTaskCount: 20));

        Assert.Equal("success", insight.Tone);
        Assert.Contains("on track", insight.Headline);
    }

    [Fact]
    public void Blockers_LeadWhenPaceIsFine()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: true, SprintName: "Sprint 7",
            Committed: 40, DonePoints: 30, ElapsedDays: 8, SprintLengthDays: 10,
            BlockedPoints: 8, BlockedTaskCount: 2, TopBlockerTitle: "Auth hardening",
            OverdueTaskCount: 0, BusiestMemberName: null, BusiestMemberWip: 0,
            OpenTaskCount: 6));

        Assert.Equal("warning", insight.Tone);
        Assert.Contains("8 pt blocked", insight.Headline);
        Assert.Contains("Auth hardening", insight.Detail);
        Assert.Contains("2 blocked", insight.Highlights);
    }

    [Fact]
    public void OnTrack_CallsOutBusiestMember()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: true, SprintName: "Sprint 7",
            Committed: 40, DonePoints: 34, ElapsedDays: 8, SprintLengthDays: 10,
            BlockedPoints: 0, BlockedTaskCount: 0, TopBlockerTitle: null,
            OverdueTaskCount: 0, BusiestMemberName: "Marcus", BusiestMemberWip: 5,
            OpenTaskCount: 4));

        Assert.Equal("success", insight.Tone);
        Assert.Contains("Marcus", insight.Detail);
        Assert.Contains("Marcus · 5 WIP", insight.Highlights);
    }

    [Fact]
    public void NoSprint_WithOverdue_Warns()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: false, SprintName: null,
            Committed: 0, DonePoints: 0, ElapsedDays: 0, SprintLengthDays: 0,
            BlockedPoints: 0, BlockedTaskCount: 0, TopBlockerTitle: null,
            OverdueTaskCount: 3, BusiestMemberName: null, BusiestMemberWip: 0,
            OpenTaskCount: 9));

        Assert.Equal("warning", insight.Tone);
        Assert.Contains("3 tasks overdue", insight.Headline);
    }

    [Fact]
    public void NoSprint_NothingOpen_IsCalm()
    {
        var insight = WeeklyInsightCalculator.Compute(new(
            HasActiveSprint: false, SprintName: null,
            Committed: 0, DonePoints: 0, ElapsedDays: 0, SprintLengthDays: 0,
            BlockedPoints: 0, BlockedTaskCount: 0, TopBlockerTitle: null,
            OverdueTaskCount: 0, BusiestMemberName: null, BusiestMemberWip: 0,
            OpenTaskCount: 0));

        Assert.Equal("info", insight.Tone);
        Assert.Empty(insight.Highlights);
    }
}

public class PortfolioHealthCalculatorTests
{
    [Fact]
    public void NoOpenWork_IsFullyHealthy()
    {
        var score = PortfolioHealthCalculator.Score(new(0, 0, 0));
        Assert.Equal(100, score);
        Assert.Equal("Healthy", PortfolioHealthCalculator.Band(score));
    }

    [Fact]
    public void CleanOpenWork_StaysHealthy()
    {
        // 20 open, none overdue / at risk → no penalty.
        Assert.Equal(100, PortfolioHealthCalculator.Score(new(20, 0, 0)));
    }

    [Fact]
    public void AllOverdue_IsCritical()
    {
        // Full overdue share → 60 penalty → 40.
        var score = PortfolioHealthCalculator.Score(new(10, 10, 0));
        Assert.Equal(40, score);
        Assert.Equal("Critical", PortfolioHealthCalculator.Band(score));
    }

    [Fact]
    public void HalfOverdue_LandsAtRisk()
    {
        // Half overdue → 30 penalty → 70.
        var score = PortfolioHealthCalculator.Score(new(10, 5, 0));
        Assert.Equal(70, score);
        Assert.Equal("At risk", PortfolioHealthCalculator.Band(score));
    }

    [Fact]
    public void OverdueAndAtRisk_StackPenalties()
    {
        // Half overdue (30) + half at risk (12.5) → 100 - 42.5 → 58 (rounded).
        var score = PortfolioHealthCalculator.Score(new(10, 5, 5));
        Assert.Equal(58, score);
    }

    [Fact]
    public void MiscountedDimensions_ClampToOpenItems()
    {
        // Overdue/at-risk above the open count can't exceed their weights.
        Assert.Equal(15, PortfolioHealthCalculator.Score(new(4, 9, 9)));
    }
}
