using Application.Features.AI;

namespace Unit;

public class ReassignmentScorerTests
{
    [Fact]
    public void PerfectMatch_ScoresHigh()
    {
        // All skills shared, no open work, lots of epic history.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: ["react", "node"],
            CandidateSkillTags: ["react", "node"],
            CandidateOpenTasksInProject: 0,
            CandidateCapacityHoursPerWeek: 40,
            CandidateDoneTasksInEpic: 5));
        Assert.Equal(1.0, s.SkillMatch);
        Assert.Equal(1.0, s.CapacityHeadroom);
        Assert.Equal(1.0, s.HistoryFit);
        Assert.Equal(1.0, s.Composite);
    }

    [Fact]
    public void SaturatedCandidate_ScoresZeroOnCapacity()
    {
        // Eight open tasks = full plate. Capacity head-room hits zero
        // even with perfect skills.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: ["sql"],
            CandidateSkillTags: ["sql"],
            CandidateOpenTasksInProject: ReassignmentScorer.CapacitySaturation,
            CandidateCapacityHoursPerWeek: 40,
            CandidateDoneTasksInEpic: 0));
        Assert.Equal(1.0, s.SkillMatch);
        Assert.Equal(0.0, s.CapacityHeadroom);
        Assert.Equal(0.0, s.HistoryFit);
        // 0.45 only — should fall behind a moderately busy expert.
        Assert.Equal(0.45, s.Composite);
    }

    [Fact]
    public void NoCapacityContract_ZerosOutCapacityScore()
    {
        // Capacity = 0 (e.g. paused contractor) → never recommend.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: ["go"],
            CandidateSkillTags: ["go"],
            CandidateOpenTasksInProject: 0,
            CandidateCapacityHoursPerWeek: 0,
            CandidateDoneTasksInEpic: 3));
        Assert.Equal(0.0, s.CapacityHeadroom);
    }

    [Fact]
    public void NoLeavingSkills_FallsBackToNeutralSkillScore()
    {
        // We can't tell whether candidate matches if we don't know what
        // the leaving member did — treat as neutral so candidates aren't
        // unfairly penalised.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: [],
            CandidateSkillTags: ["python"],
            CandidateOpenTasksInProject: 0,
            CandidateCapacityHoursPerWeek: 40,
            CandidateDoneTasksInEpic: 0));
        Assert.Equal(0.5, s.SkillMatch);
    }

    [Fact]
    public void PartialSkillMatch_ProportionalScore()
    {
        // Candidate has 1 of leaving member's 4 skills → 0.25 score.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: ["a", "b", "c", "d"],
            CandidateSkillTags: ["a", "x", "y"],
            CandidateOpenTasksInProject: 4,
            CandidateCapacityHoursPerWeek: 40,
            CandidateDoneTasksInEpic: 0));
        Assert.Equal(0.25, s.SkillMatch);
    }

    [Fact]
    public void SkillMatch_IsCaseInsensitive()
    {
        // Normalisation runs in the scorer, not just at write time —
        // protects against pre-existing rows with mixed case.
        var s = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            LeavingMemberSkillTags: ["React"],
            CandidateSkillTags: ["react"],
            CandidateOpenTasksInProject: 0,
            CandidateCapacityHoursPerWeek: 40,
            CandidateDoneTasksInEpic: 0));
        Assert.Equal(1.0, s.SkillMatch);
    }

    [Fact]
    public void HistorySaturation_CapsAtOne()
    {
        // 10 done in epic shouldn't beat 3 done in epic — both saturate.
        var fewer = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            ["a"], ["a"], 0, 40, ReassignmentScorer.HistorySaturation));
        var many = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            ["a"], ["a"], 0, 40, 30));
        Assert.Equal(1.0, fewer.HistoryFit);
        Assert.Equal(1.0, many.HistoryFit);
        Assert.Equal(fewer.Composite, many.Composite);
    }

    [Fact]
    public void WeightedComposite_FavoursSkillOverCapacity()
    {
        // Candidate A: perfect skill, no capacity.
        // Candidate B: no skill, full capacity.
        // A should outrank B because the skill weight (0.45) > capacity (0.35).
        var a = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            ["x"], ["x"], ReassignmentScorer.CapacitySaturation, 40, 0));
        var b = ReassignmentScorer.Score(new ReassignmentCandidateInput(
            ["x"], ["y"], 0, 40, 0));
        Assert.True(a.Composite > b.Composite);
    }
}
