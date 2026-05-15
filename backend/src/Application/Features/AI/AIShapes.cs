namespace Application.Features.AI;

public record AIGeneratedTask(string Title, string Description);

public record AIGeneratedStory(
    string Title,
    string Description,
    int StoryPoints,
    string Priority,
    IReadOnlyList<string> AcceptanceCriteria,
    IReadOnlyList<AIGeneratedTask> Tasks);

public record AIGeneratedEpic(
    string Title,
    string Description,
    string? Color,
    IReadOnlyList<AIGeneratedStory> Stories);

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
    Guid StoryId,
    string Title,
    int Points,
    string Priority,
    IReadOnlyList<Guid> BlockedByStoryIds);

public record AISprintFillInput(
    int CapacityPoints,
    IReadOnlyList<AISprintFillCandidate> Backlog,
    IReadOnlyList<Guid> AlreadyInSprint);

public record AISprintFillPick(Guid StoryId, string Reasoning);

public record AISprintFillPlan(
    int TargetCapacityPoints,
    int SelectedPoints,
    IReadOnlyList<AISprintFillPick> Picks,
    string Reasoning);
