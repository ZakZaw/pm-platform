using Application.Features.AI;

namespace Unit;

public class VelocityProjectionTests
{
    [Fact]
    public void OnPace_NoShortfall()
    {
        // Team committed 30 points, half-way through a 10-day sprint
        // with 15 done. Recent average is 30. No shortfall.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 15,
            daysElapsed: 5,
            daysTotal: 10,
            recentVelocities: [30, 28, 32]);
        Assert.Equal(0, result.ProjectedShortfallPoints);
        Assert.Equal(0, result.ProjectedDaysBehind);
    }

    [Fact]
    public void CurrentPaceBelowHistorical_PicksThePessimisticForecast()
    {
        // Recent average is 30, but current pace projects to only 20
        // (5/2.5*10 = 20). Projection should use 20, not 30.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 5,
            daysElapsed: 3,
            daysTotal: 10,
            recentVelocities: [30, 30, 30]);
        Assert.Equal(17, result.ProjectedDelivered); // 5/3*10 = 16.67 -> 17
        Assert.Equal(13, result.ProjectedShortfallPoints);
    }

    [Fact]
    public void HistoricalBelowCurrentPace_PicksHistorical()
    {
        // Team running hot this sprint (current rate projects 50) but
        // historically only delivers 20. Use the conservative number.
        var result = VelocityProjection.Project(
            committedPoints: 40,
            donePoints: 25,
            daysElapsed: 5,
            daysTotal: 10,
            recentVelocities: [20, 20, 20]);
        Assert.Equal(20, result.ProjectedDelivered);
        Assert.Equal(20, result.ProjectedShortfallPoints);
    }

    [Fact]
    public void EmptyHistory_FallsBackToCurrentRate()
    {
        // First sprint ever — no history. Current pace is 10/5*10 = 20.
        // Committed 30, projected 20, shortfall 10.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 10,
            daysElapsed: 5,
            daysTotal: 10,
            recentVelocities: []);
        Assert.Equal(20, result.ProjectedDelivered);
        Assert.Equal(10, result.ProjectedShortfallPoints);
    }

    [Fact]
    public void NoHistoryAndNoElapsedTime_ZeroShortfall()
    {
        // Day-zero of a brand new project — refuse to project rather
        // than fire a useless card.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 0,
            daysElapsed: 0,
            daysTotal: 10,
            recentVelocities: []);
        Assert.Equal(0, result.ProjectedDelivered);
        Assert.Equal(0, result.ProjectedShortfallPoints);
        Assert.Equal(0, result.ProjectedDaysBehind);
    }

    [Fact]
    public void DaysBehind_ScaledByThroughput()
    {
        // History averages 20 points / 10 days = 2 points/day. We
        // project 10 points short, so we're 5 days behind.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 10,
            daysElapsed: 5,
            daysTotal: 10,
            recentVelocities: [20, 20, 20]);
        Assert.Equal(2.0, result.PointsPerDay);
        Assert.Equal(10, result.ProjectedShortfallPoints);
        Assert.Equal(5, result.ProjectedDaysBehind);
    }

    [Fact]
    public void DaysBehindExceedsThreshold_TripsTheWire()
    {
        // 25 points short with 1 point/day throughput = 25 days
        // behind. The scanner's 10-day threshold trips.
        var result = VelocityProjection.Project(
            committedPoints: 30,
            donePoints: 5,
            daysElapsed: 5,
            daysTotal: 10,
            recentVelocities: [10, 10, 10]);
        Assert.True(result.ProjectedDaysBehind > VelocityProjection.DefaultDelayThresholdDays);
    }

    [Fact]
    public void DaysTotalZero_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            VelocityProjection.Project(30, 0, 0, 0, []));
    }
}
