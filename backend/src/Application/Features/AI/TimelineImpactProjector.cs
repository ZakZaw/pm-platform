namespace Application.Features.AI;

/// <summary>
/// F2-14 — pure projection that turns "this epic adds N story points"
/// into concrete timeline impact: how many sprints we expect it to
/// take, which open sprints would overflow if it got jammed into them,
/// and which downstream milestones would shift.
///
/// The projector is intentionally deliberate-with-its-assumptions:
/// every output number ties back to a single input (velocity, sprint
/// length, current sprint commitment). Anything fancier (per-task
/// dependency scheduling, multi-stream parallelism) belongs in a
/// later iteration, not here — the F2-14 AC is "show impact before
/// commit", not "predict the future".
/// </summary>
public static class TimelineImpactProjector
{
    /// <summary>
    /// Fallback velocity used when the project has no recent closed
    /// sprints at all. Tuned to a plausibly small team — 20 points per
    /// 2-week sprint. The UI surfaces the projection as "estimated"
    /// either way, so the fallback being slightly off is fine.
    /// </summary>
    public const int FallbackVelocity = 20;

    /// <summary>
    /// Fallback sprint length in days when we can't read it off the
    /// most recent active/planning sprint.
    /// </summary>
    public const int FallbackSprintLengthDays = 14;

    /// <summary>
    /// Window for the milestone scan. Anything beyond is too noisy to
    /// project against — the velocity assumption decays fast.
    /// </summary>
    public const int MilestoneWindowDays = 90;

    public static TimelineImpactResult Project(TimelineImpactInput input)
    {
        var velocity = input.RecentClosedVelocities.Count > 0
            ? (int)Math.Round(input.RecentClosedVelocities.Average())
            : FallbackVelocity;
        if (velocity <= 0) velocity = FallbackVelocity;

        var sprintLen = input.AverageSprintLengthDays > 0
            ? input.AverageSprintLengthDays
            : FallbackSprintLengthDays;

        var addedPoints = Math.Max(0, input.AddedStoryPoints);

        // Sprints-to-complete is the deliberate "if we ran this epic
        // through the team's average sprint" answer. Zero added points
        // = zero sprints; otherwise we round up so a fractional sprint
        // still counts as one we'd block.
        var sprintsToComplete = addedPoints == 0
            ? 0
            : (int)Math.Ceiling(addedPoints / (double)velocity);

        // Per-sprint overflow: how many points would spill past the
        // sprint's remaining capacity if every new task were dropped
        // into it. We treat absent VelocityTarget as the sprint's
        // current committed-points snapshot (so empty sprints can still
        // hold work).
        var sprintImpacts = new List<SprintImpact>(input.OpenSprints.Count);
        foreach (var s in input.OpenSprints)
        {
            var target = s.VelocityTargetPoints
                ?? Math.Max(velocity, s.CommittedPoints);
            var remaining = Math.Max(0, target - s.CommittedPoints);
            var overflow = Math.Max(0, addedPoints - remaining);
            sprintImpacts.Add(new SprintImpact(
                SprintId: s.SprintId,
                Name: s.Name,
                Status: s.Status,
                CommittedPoints: s.CommittedPoints,
                TargetPoints: target,
                RemainingCapacityPoints: remaining,
                ProjectedOverflowPoints: overflow,
                WouldFit: overflow == 0 && addedPoints > 0));
        }

        // Milestone shift: how many calendar days the epic eats. We
        // use the per-sprint cadence (velocity points per sprintLen
        // days) so the shift scales with the team's actual throughput.
        // Past or out-of-window milestones aren't projected — the UI
        // only renders what's actionable.
        var pointsPerDay = (double)velocity / sprintLen;
        var shiftDays = pointsPerDay > 0
            ? (int)Math.Ceiling(addedPoints / pointsPerDay)
            : 0;

        var milestoneImpacts = new List<MilestoneImpact>(input.Milestones.Count);
        foreach (var m in input.Milestones)
        {
            var daysUntil = (m.Date.DayNumber - input.TodayDate.DayNumber);
            if (daysUntil < 0 || daysUntil > MilestoneWindowDays) continue;
            milestoneImpacts.Add(new MilestoneImpact(
                MilestoneId: m.MilestoneId,
                Title: m.Title,
                Date: m.Date,
                DaysUntil: daysUntil,
                ProjectedShiftDays: shiftDays));
        }

        return new TimelineImpactResult(
            AddedStoryPoints: addedPoints,
            ProjectVelocityPointsPerSprint: velocity,
            AverageSprintLengthDays: sprintLen,
            HasHistoricalVelocity: input.RecentClosedVelocities.Count > 0,
            EstimatedSprintsToComplete: sprintsToComplete,
            ProjectedShiftDays: shiftDays,
            Sprints: sprintImpacts,
            Milestones: milestoneImpacts);
    }
}

public record TimelineImpactInput(
    int AddedStoryPoints,
    int AverageSprintLengthDays,
    IReadOnlyList<int> RecentClosedVelocities,
    IReadOnlyList<OpenSprintSnapshot> OpenSprints,
    IReadOnlyList<MilestoneSnapshot> Milestones,
    DateOnly TodayDate);

public record OpenSprintSnapshot(
    Guid SprintId,
    string Name,
    string Status,
    int CommittedPoints,
    int? VelocityTargetPoints);

public record MilestoneSnapshot(
    Guid MilestoneId,
    string Title,
    DateOnly Date);

public record TimelineImpactResult(
    int AddedStoryPoints,
    int ProjectVelocityPointsPerSprint,
    int AverageSprintLengthDays,
    bool HasHistoricalVelocity,
    int EstimatedSprintsToComplete,
    int ProjectedShiftDays,
    IReadOnlyList<SprintImpact> Sprints,
    IReadOnlyList<MilestoneImpact> Milestones);

public record SprintImpact(
    Guid SprintId,
    string Name,
    string Status,
    int CommittedPoints,
    int TargetPoints,
    int RemainingCapacityPoints,
    int ProjectedOverflowPoints,
    bool WouldFit);

public record MilestoneImpact(
    Guid MilestoneId,
    string Title,
    DateOnly Date,
    int DaysUntil,
    int ProjectedShiftDays);
