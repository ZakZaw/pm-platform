using Application.Features.AI;

namespace Unit;

public class TimelineImpactProjectorTests
{
    private static readonly DateOnly Today = new(2026, 5, 27);

    [Fact]
    public void NoHistory_FallsBackToDefaultVelocity()
    {
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 40,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [],
            OpenSprints: [],
            Milestones: [],
            TodayDate: Today));
        Assert.False(r.HasHistoricalVelocity);
        Assert.Equal(TimelineImpactProjector.FallbackVelocity, r.ProjectVelocityPointsPerSprint);
        // 40 points / 20 per sprint = 2 sprints.
        Assert.Equal(2, r.EstimatedSprintsToComplete);
    }

    [Fact]
    public void RecentVelocities_AveragedAndRoundedToInt()
    {
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 30,
            AverageSprintLengthDays: 10,
            RecentClosedVelocities: [22, 18, 21],
            OpenSprints: [],
            Milestones: [],
            TodayDate: Today));
        // (22 + 18 + 21) / 3 = 20.33 -> 20
        Assert.Equal(20, r.ProjectVelocityPointsPerSprint);
        Assert.True(r.HasHistoricalVelocity);
        // 30 / 20 = 1.5 -> ceil = 2
        Assert.Equal(2, r.EstimatedSprintsToComplete);
    }

    [Fact]
    public void ZeroAddedPoints_NoSprintsNeeded()
    {
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 0,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [20],
            OpenSprints: [],
            Milestones: [],
            TodayDate: Today));
        Assert.Equal(0, r.EstimatedSprintsToComplete);
        Assert.Equal(0, r.ProjectedShiftDays);
    }

    [Fact]
    public void SprintOverflow_UsesVelocityTargetWhenSet()
    {
        // Sprint already committed 15 of a 25-point target = 10
        // remaining. Adding 18 points overflows by 8.
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 18,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [20],
            OpenSprints: [new OpenSprintSnapshot(
                SprintId: Guid.NewGuid(),
                Name: "S1",
                Status: "Active",
                CommittedPoints: 15,
                VelocityTargetPoints: 25)],
            Milestones: [],
            TodayDate: Today));
        var s = Assert.Single(r.Sprints);
        Assert.Equal(10, s.RemainingCapacityPoints);
        Assert.Equal(8, s.ProjectedOverflowPoints);
        Assert.False(s.WouldFit);
    }

    [Fact]
    public void SprintFits_NoOverflow()
    {
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 5,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [20],
            OpenSprints: [new OpenSprintSnapshot(
                SprintId: Guid.NewGuid(),
                Name: "S1",
                Status: "Planning",
                CommittedPoints: 10,
                VelocityTargetPoints: 25)],
            Milestones: [],
            TodayDate: Today));
        var s = Assert.Single(r.Sprints);
        Assert.Equal(0, s.ProjectedOverflowPoints);
        Assert.True(s.WouldFit);
    }

    [Fact]
    public void MilestoneShift_ScaledByVelocityCadence()
    {
        // velocity 20 / 10 days = 2 pts/day. 30 points => 15-day shift.
        var milestoneId = Guid.NewGuid();
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 30,
            AverageSprintLengthDays: 10,
            RecentClosedVelocities: [20],
            OpenSprints: [],
            Milestones: [new MilestoneSnapshot(milestoneId, "GA", Today.AddDays(30))],
            TodayDate: Today));
        Assert.Equal(15, r.ProjectedShiftDays);
        var m = Assert.Single(r.Milestones);
        Assert.Equal(15, m.ProjectedShiftDays);
        Assert.Equal(30, m.DaysUntil);
    }

    [Fact]
    public void PastAndOutOfWindowMilestones_AreDropped()
    {
        // One in the past, one 200 days out — both filtered.
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 10,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [20],
            OpenSprints: [],
            Milestones: [
                new MilestoneSnapshot(Guid.NewGuid(), "Past", Today.AddDays(-3)),
                new MilestoneSnapshot(Guid.NewGuid(), "Way out", Today.AddDays(200)),
                new MilestoneSnapshot(Guid.NewGuid(), "Soon", Today.AddDays(20)),
            ],
            TodayDate: Today));
        Assert.Single(r.Milestones);
        Assert.Equal("Soon", r.Milestones[0].Title);
    }

    [Fact]
    public void EmptyTargetSprint_FallsBackToVelocityCapacity()
    {
        // No VelocityTarget set. Effective target = velocity (20). With
        // 5 already committed, 15 remaining.
        var r = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: 12,
            AverageSprintLengthDays: 14,
            RecentClosedVelocities: [20],
            OpenSprints: [new OpenSprintSnapshot(
                SprintId: Guid.NewGuid(),
                Name: "S1",
                Status: "Planning",
                CommittedPoints: 5,
                VelocityTargetPoints: null)],
            Milestones: [],
            TodayDate: Today));
        var s = Assert.Single(r.Sprints);
        Assert.Equal(20, s.TargetPoints);
        Assert.Equal(15, s.RemainingCapacityPoints);
        Assert.True(s.WouldFit);
    }
}
