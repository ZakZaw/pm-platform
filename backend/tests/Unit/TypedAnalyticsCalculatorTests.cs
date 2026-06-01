using Application.Features.Analytics;

namespace Unit;

public class SalesFunnelCalculatorTests
{
    [Fact]
    public void Funnel_ConvertsRelativeToEntryStage()
    {
        var rows = SalesFunnelCalculator.Funnel(
        [
            new("Discover", 20, 0),
            new("Qualify", 10, 0),
            new("Propose", 5, 0),
        ]);

        Assert.Equal(100.0, rows[0].ConversionPct);
        Assert.Equal(50.0, rows[1].ConversionPct);
        Assert.Equal(25.0, rows[2].ConversionPct);
    }

    [Fact]
    public void Funnel_EmptyEntry_FallsBackToWidestStage()
    {
        // Entry stage empty — normalise against the widest so bars still render.
        var rows = SalesFunnelCalculator.Funnel(
        [
            new("Discover", 0, 0),
            new("Qualify", 8, 0),
            new("Propose", 4, 0),
        ]);

        Assert.Equal(0.0, rows[0].ConversionPct);
        Assert.Equal(100.0, rows[1].ConversionPct);
        Assert.Equal(50.0, rows[2].ConversionPct);
    }

    [Fact]
    public void Funnel_NoStages_IsEmpty() =>
        Assert.Empty(SalesFunnelCalculator.Funnel([]));

    [Fact]
    public void WeightedForecast_SumsValueTimesProbability()
    {
        var forecast = SalesFunnelCalculator.WeightedForecast(
        [
            (10_000m, 50),
            (20_000m, 25),
        ]);
        // 5_000 + 5_000 = 10_000.
        Assert.Equal(10_000m, forecast);
    }

    [Fact]
    public void WeightedForecast_ClampsProbabilityToHundred()
    {
        var forecast = SalesFunnelCalculator.WeightedForecast([(10_000m, 250)]);
        Assert.Equal(10_000m, forecast);
    }

    [Fact]
    public void WinRate_NullWhenNothingClosed() =>
        Assert.Null(SalesFunnelCalculator.WinRatePct(0, 0));

    [Fact]
    public void WinRate_IsWonOverClosed() =>
        Assert.Equal(75.0, SalesFunnelCalculator.WinRatePct(3, 1));
}

public class SlaAttainmentCalculatorTests
{
    private static readonly DateTime Due = new(2026, 5, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void NoResolved_ReturnsNull() =>
        Assert.Null(SlaAttainmentCalculator.AttainmentPct([]));

    [Fact]
    public void ResolvedAtDeadline_CountsAsMet()
    {
        var pct = SlaAttainmentCalculator.AttainmentPct([(Due, Due)]);
        Assert.Equal(100.0, pct);
    }

    [Fact]
    public void MixedResolutions_ComputeShareMet()
    {
        var pct = SlaAttainmentCalculator.AttainmentPct(
        [
            (Due.AddHours(-1), Due),   // met
            (Due.AddHours(-2), Due),   // met
            (Due.AddHours(1), Due),    // breached
            (Due.AddHours(3), Due),    // breached
        ]);
        Assert.Equal(50.0, pct);
    }
}

public class ThroughputCalculatorTests
{
    // A Wednesday — the week it belongs to starts the preceding Monday.
    private static readonly DateTime AsOf = new(2026, 5, 27, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ProducesRequestedNumberOfWeeks_OldestFirst()
    {
        var buckets = ThroughputCalculator.Weekly([], AsOf, 4);
        Assert.Equal(4, buckets.Count);
        Assert.True(buckets[0].WeekStart < buckets[3].WeekStart);
        // Last bucket is the week containing AsOf (Monday 2026-05-25).
        Assert.Equal(new DateTime(2026, 5, 25), buckets[3].WeekStart);
    }

    [Fact]
    public void BucketsDatesIntoTheirWeek()
    {
        var dates = new[]
        {
            new DateTime(2026, 5, 26), // current week (Tue)
            new DateTime(2026, 5, 25), // current week (Mon)
            new DateTime(2026, 5, 20), // previous week (Wed)
        };
        var buckets = ThroughputCalculator.Weekly(dates, AsOf, 4);
        Assert.Equal(2, buckets[3].Count); // current week
        Assert.Equal(1, buckets[2].Count); // previous week
    }

    [Fact]
    public void IgnoresDatesOutsideWindow()
    {
        var dates = new[] { new DateTime(2026, 1, 1), new DateTime(2030, 1, 1) };
        var buckets = ThroughputCalculator.Weekly(dates, AsOf, 4);
        Assert.All(buckets, b => Assert.Equal(0, b.Count));
    }
}

public class RunCompletionCalculatorTests
{
    [Fact]
    public void NoRuns_AllNull()
    {
        var rates = RunCompletionCalculator.Compute(new(0, 0, 0, 0));
        Assert.Null(rates.CompletionPct);
        Assert.Null(rates.OnTimePct);
        Assert.Null(rates.SkipPct);
        Assert.Equal(0, rates.Total);
    }

    [Fact]
    public void RatesShareTheFullWindow()
    {
        // 6 completed, 2 skipped, 2 missed → 10 total.
        var rates = RunCompletionCalculator.Compute(new(Completed: 6, OnTime: 3, Skipped: 2, Missed: 2));
        Assert.Equal(60.0, rates.CompletionPct);
        Assert.Equal(20.0, rates.SkipPct);
        Assert.Equal(10, rates.Total);
    }

    [Fact]
    public void OnTimeIsMeasuredAmongCompletedOnly()
    {
        var rates = RunCompletionCalculator.Compute(new(Completed: 4, OnTime: 3, Skipped: 0, Missed: 0));
        Assert.Equal(75.0, rates.OnTimePct);
    }

    [Fact]
    public void OnTimeNullWhenNothingCompleted()
    {
        var rates = RunCompletionCalculator.Compute(new(Completed: 0, OnTime: 0, Skipped: 3, Missed: 1));
        Assert.Null(rates.OnTimePct);
        Assert.Equal(75.0, rates.SkipPct);
    }
}
