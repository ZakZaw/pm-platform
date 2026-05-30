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
