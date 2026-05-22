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
