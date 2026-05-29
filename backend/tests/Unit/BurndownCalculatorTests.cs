using Application.Features.Analytics;

namespace Unit;

public class BurndownCalculatorTests
{
    private static readonly DateTime Start = new(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void IdealLine_RunsFromTotalToZero()
    {
        // 10-day window, 40 points. Ideal starts at 40, ends at 0, with the
        // midpoint at 20.
        var end = Start.AddDays(10);
        var points = BurndownCalculator.Build(Start, end, now: end, totalPoints: 40, completions: []);

        Assert.Equal(11, points.Count); // day 0..10 inclusive
        Assert.Equal(40, points[0].Ideal);
        Assert.Equal(20, points[5].Ideal);
        Assert.Equal(0, points[10].Ideal);
    }

    [Fact]
    public void FutureDays_HaveNullRemaining()
    {
        // 10-day sprint, "now" is day 3. Days 4..10 must be null so the
        // actual line stops at today.
        var end = Start.AddDays(10);
        var points = BurndownCalculator.Build(Start, end, now: Start.AddDays(3), totalPoints: 40, completions: []);

        Assert.NotNull(points[3].Remaining);
        Assert.Null(points[4].Remaining);
        Assert.Null(points[10].Remaining);
    }

    [Fact]
    public void Remaining_DropsAsTasksComplete()
    {
        // 40 committed. 10 points done on day 2, another 15 on day 4.
        var end = Start.AddDays(10);
        var completions = new[]
        {
            new BurndownCalculator.Completion(Start.AddDays(2).AddHours(9), 10),
            new BurndownCalculator.Completion(Start.AddDays(4).AddHours(9), 15),
        };
        var points = BurndownCalculator.Build(Start, end, now: end, totalPoints: 40, completions);

        Assert.Equal(40, points[0].Remaining);  // nothing done yet
        Assert.Equal(40, points[1].Remaining);
        Assert.Equal(30, points[2].Remaining);  // 10 burned
        Assert.Equal(30, points[3].Remaining);
        Assert.Equal(15, points[4].Remaining);  // 25 burned
        Assert.Equal(15, points[10].Remaining);
    }

    [Fact]
    public void Remaining_NeverGoesNegative_WhenScopeOvershoots()
    {
        // More completed than committed (edge: points edited down after
        // close). Remaining floors at zero.
        var end = Start.AddDays(5);
        var completions = new[] { new BurndownCalculator.Completion(Start.AddDays(1).AddHours(1), 50) };
        var points = BurndownCalculator.Build(Start, end, now: end, totalPoints: 40, completions);

        Assert.Equal(0, points[4].Remaining);
    }

    [Fact]
    public void SameDayWindow_StillProducesADefinedSlope()
    {
        // start == end must not divide by zero; treated as a one-day window.
        var points = BurndownCalculator.Build(Start, Start, now: Start, totalPoints: 20, completions: []);

        Assert.Equal(2, points.Count); // day 0 and day 1
        Assert.Equal(20, points[0].Ideal);
        Assert.Equal(0, points[1].Ideal);
    }

    [Fact]
    public void TodayIndex_IsClampedToWindow()
    {
        var end = Start.AddDays(10);
        Assert.Equal(0, BurndownCalculator.TodayIndex(Start, end, Start.AddDays(-5)));
        Assert.Equal(4, BurndownCalculator.TodayIndex(Start, end, Start.AddDays(4)));
        Assert.Equal(10, BurndownCalculator.TodayIndex(Start, end, Start.AddDays(99)));
    }
}
