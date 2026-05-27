namespace Application.Features.AI;

/// <summary>
/// F2-13 — pure scoring for the "member unavailable" reassignment
/// suggestion. The handler pulls candidate state from EF and then calls
/// <see cref="Score"/> per task so the math is unit-testable without a
/// database.
///
/// The composite is a weighted sum of three normalised sub-scores in
/// [0,1]:
/// <list type="bullet">
///   <item><b>Skill match</b> — fraction of the leaving member's skill
///     tags that the candidate also has. Heuristic for "they can pick
///     up the same kind of work".</item>
///   <item><b>Capacity headroom</b> — how much of the candidate's
///     contracted capacity is free, given their current open-task
///     count in the project. Saturates at 8 open tasks = no
///     headroom.</item>
///   <item><b>History</b> — has the candidate already finished tasks
///     under the same epic? Saturates at 3 done tasks.</item>
/// </list>
/// Weights favour skill match because a free body without the right
/// skills is a worse fit than a busy expert.
/// </summary>
public static class ReassignmentScorer
{
    public const double WeightSkill = 0.45;
    public const double WeightCapacity = 0.35;
    public const double WeightHistory = 0.20;

    /// <summary>Max open tasks before capacity headroom hits zero.</summary>
    public const int CapacitySaturation = 8;

    /// <summary>Min done-in-epic before history score saturates.</summary>
    public const int HistorySaturation = 3;

    public static ReassignmentScore Score(ReassignmentCandidateInput input)
    {
        var skill = SkillMatch(input.CandidateSkillTags, input.LeavingMemberSkillTags);
        var capacity = CapacityHeadroom(input.CandidateOpenTasksInProject,
            input.CandidateCapacityHoursPerWeek);
        var history = HistoryFit(input.CandidateDoneTasksInEpic);
        var composite = WeightSkill * skill
                      + WeightCapacity * capacity
                      + WeightHistory * history;
        return new ReassignmentScore(
            Composite: Math.Round(composite, 4),
            SkillMatch: Math.Round(skill, 4),
            CapacityHeadroom: Math.Round(capacity, 4),
            HistoryFit: Math.Round(history, 4));
    }

    private static double SkillMatch(
        IReadOnlyCollection<string> candidate,
        IReadOnlyCollection<string> leaving)
    {
        // No skill data on the leaving member means we can't tell — treat
        // every candidate as a neutral 0.5 rather than zero, so a free
        // member without overlap isn't penalised for missing inputs.
        if (leaving.Count == 0) return 0.5;
        if (candidate.Count == 0) return 0.0;

        var candidateSet = new HashSet<string>(
            candidate.Select(t => t.Trim().ToLowerInvariant()),
            StringComparer.Ordinal);
        var matched = 0;
        foreach (var t in leaving)
        {
            var key = (t ?? string.Empty).Trim().ToLowerInvariant();
            if (key.Length == 0) continue;
            if (candidateSet.Contains(key)) matched++;
        }
        return Math.Clamp((double)matched / leaving.Count, 0, 1);
    }

    private static double CapacityHeadroom(int openTasks, int capacityHoursPerWeek)
    {
        // A user with zero contracted capacity should never be picked.
        if (capacityHoursPerWeek <= 0) return 0.0;

        // Headroom decays linearly as the candidate's open-task count
        // climbs toward saturation. At CapacitySaturation we stop
        // recommending them at all.
        var fillRatio = Math.Min(1.0, (double)openTasks / CapacitySaturation);
        return Math.Clamp(1.0 - fillRatio, 0, 1);
    }

    private static double HistoryFit(int doneInEpic)
    {
        if (doneInEpic <= 0) return 0.0;
        return Math.Clamp((double)doneInEpic / HistorySaturation, 0, 1);
    }
}

public record ReassignmentCandidateInput(
    IReadOnlyCollection<string> LeavingMemberSkillTags,
    IReadOnlyCollection<string> CandidateSkillTags,
    int CandidateOpenTasksInProject,
    int CandidateCapacityHoursPerWeek,
    int CandidateDoneTasksInEpic);

public record ReassignmentScore(
    double Composite,
    double SkillMatch,
    double CapacityHeadroom,
    double HistoryFit);
