namespace Application.Features.AI;

public record AIGeneratedTask(
    string Title,
    string Description,
    int StoryPoints,
    string Priority,
    IReadOnlyList<string> AcceptanceCriteria);

public record AIGeneratedEpic(
    string Title,
    string Description,
    string? Color,
    IReadOnlyList<AIGeneratedTask> Tasks);

public record AIGeneratedProject(
    string SuggestedName,
    IReadOnlyList<AIGeneratedEpic> Epics);

public record AIClarificationAnswer(string Question, string Answer);

public record AIEstimationInput(
    string Title,
    string? Description,
    IReadOnlyList<string> AcceptanceCriteria,
    IReadOnlyList<AIEstimationSample> SimilarHistory);

public record AIEstimationSample(string Title, int Points);

public record AIEffortEstimate(int Points, double Confidence, string Reasoning);

public record AISprintFillCandidate(
    Guid TaskId,
    string Title,
    int Points,
    string Priority,
    IReadOnlyList<Guid> BlockedByTaskIds);

public record AISprintFillInput(
    int CapacityPoints,
    IReadOnlyList<AISprintFillCandidate> Backlog,
    IReadOnlyList<Guid> AlreadyInSprint);

public record AISprintFillPick(Guid TaskId, string Reasoning);

public record AISprintFillPlan(
    int TargetCapacityPoints,
    int SelectedPoints,
    IReadOnlyList<AISprintFillPick> Picks,
    string Reasoning);

public record AIEpicGenerationInput(
    string ProjectName,
    string ProjectType,
    string Description,
    IReadOnlyList<string> ExistingEpicTitles);

public record AITaskListGenerationInput(
    string ProjectName,
    string ProjectType,
    string Description,
    string? EpicTitle,
    int? MaxTasks);

public record AITaskBreakdownInput(
    string Title,
    string? Description,
    IReadOnlyList<string> ExistingAcceptanceCriteria,
    int? CurrentStoryPoints);

public record AITaskBreakdown(
    string RefinedDescription,
    IReadOnlyList<string> AcceptanceCriteria,
    int? SuggestedStoryPoints,
    string Reasoning);

public record AISprintHealthInput(
    string ProjectName,
    string SprintName,
    int DaysElapsed,
    int DaysTotal,
    int CommittedPoints,
    int DonePoints,
    int InProgressPoints,
    int BlockedPoints,
    int? VelocityTarget,
    IReadOnlyList<string> BlockedTaskTitles,
    IReadOnlyList<int> RecentVelocities);

public record AISprintHealthInsight(
    string Title,
    string Body,
    IReadOnlyList<AISprintHealthOption> Options,
    double Confidence);

public record AISprintHealthOption(string Label, bool Recommended);

// F2-11 sprint-close retrospective.
//
// Input: enough context for the model to score the sprint without a
// re-query. Backlog candidates are highest-priority backlog items
// (with key + title + points) so the AI can suggest a sensible next-
// sprint draft without inventing tasks; the apply command later
// resolves the picks by task id, never by free-form title.

public record AIRetroBacklogCandidate(
    Guid TaskId,
    string Key,
    string Title,
    int Points,
    string Priority);

public record AIRetroSprintHistory(
    string Name,
    int CommittedPoints,
    int DeliveredPoints);

public record AISprintRetroInput(
    string ProjectName,
    string SprintName,
    string? Goal,
    int CommittedPoints,
    int DeliveredPoints,
    int Carryovers,
    IReadOnlyList<string> Blockers,
    IReadOnlyList<AIRetroSprintHistory> RecentSprints,
    IReadOnlyList<AIRetroBacklogCandidate> Backlog);

public record AIRetroDraftPick(Guid TaskId, string Reasoning);

public record AIRetroNextSprintDraft(
    string Name,
    string? Goal,
    IReadOnlyList<AIRetroDraftPick> Tasks);

public record AISprintRetrospective(
    string Summary,
    string WhatWentWell,
    string WhatDidnt,
    string Suggestions,
    AIRetroNextSprintDraft? NextSprintDraft);

// F2-12 velocity-drop replan.
//
// Input candidates are picked by the scanner before the AI call:
// CuttableTasks are the lowest-priority not-done items currently in
// the sprint; UnderutilizedMembers come from project membership minus
// the assignees already at >80% capacity; DownstreamMilestones are
// pinned to epics that contain any sprint task.
//
// The AI's job is to pick from these — invented ids are stripped by
// the parser so applying an option always references a real entity.

public record AIReplanCuttable(Guid TaskId, string Key, string Title, int Points, string Priority);
public record AIReplanMember(Guid UserId, string FullName, int CapacityHoursPerWeek);
public record AIReplanMilestone(Guid MilestoneId, string Title, DateOnly Date);

public record AIVelocityReplanInput(
    string ProjectName,
    string SprintName,
    int DaysElapsed,
    int DaysTotal,
    int CommittedPoints,
    int DonePoints,
    int ProjectedDelivered,
    int ProjectedShortfallPoints,
    int ProjectedDaysBehind,
    int RecentAverageVelocity,
    IReadOnlyList<AIReplanCuttable> CuttableTasks,
    IReadOnlyList<AIReplanMember> UnderutilizedMembers,
    IReadOnlyList<AIReplanMilestone> DownstreamMilestones);

public record AIReplanCutScopeOption(
    string Summary,
    IReadOnlyList<Guid> TaskIds,
    int PointsCut,
    int DaysSaved);

public record AIReplanAddResourceOption(
    string Summary,
    Guid? MemberId,
    IReadOnlyList<Guid> ReassignTaskIds,
    int DaysSaved);

public record AIReplanShiftMilestoneOption(
    string Summary,
    Guid? MilestoneId,
    int ShiftDays);

public record AIVelocityReplanResult(
    string Headline,
    AIReplanCutScopeOption? CutScope,
    AIReplanAddResourceOption? AddResource,
    AIReplanShiftMilestoneOption? ShiftMilestone);
