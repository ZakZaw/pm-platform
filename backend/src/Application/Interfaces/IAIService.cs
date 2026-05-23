using Application.Features.AI;

namespace Application.Interfaces;

/// <summary>
/// Single seam between Application and an AI provider. The dev impl
/// targets Google Gemini; production swaps in Anthropic Claude. All
/// methods return strongly-typed shapes — never raw JSON — so callers
/// don't depend on the provider's wire format.
/// </summary>
public interface IAIService
{
    string ProviderName { get; }
    string Model { get; }

    /// <summary>
    /// True when the provider has the credentials it needs to answer
    /// requests. Command handlers check this before calling and surface
    /// AI.NotConfigured (503) when false, instead of attempting a call
    /// that's guaranteed to fail.
    /// </summary>
    bool IsConfigured { get; }

    Task<AIGeneratedProject> GenerateProjectStructureAsync(
        string description,
        string projectType,
        IReadOnlyList<AIClarificationAnswer>? clarifications,
        CancellationToken ct);

    /// <summary>
    /// F1.5-07 — generates a typed project draft for non-Engineering
    /// project types (Sales, Support, Marketing, Operations, Generic).
    /// Each type returns its own work-model shape so the wizard and the
    /// apply command can materialise the right entities atomically.
    /// Engineering keeps using <see cref="GenerateProjectStructureAsync"/>
    /// unchanged.
    /// </summary>
    Task<AITypedProjectDraft> GenerateTypedProjectDraftAsync(
        string description,
        string projectType,
        IReadOnlyList<AIClarificationAnswer>? clarifications,
        CancellationToken ct);

    /// <summary>
    /// Generate a single epic with its tasks, scoped to an existing project.
    /// The caller passes project context (name, environment, existing-epic
    /// titles) so the AI can fit the new epic into the project without
    /// duplicating work already planned.
    /// </summary>
    Task<AIGeneratedEpic> GenerateEpicStructureAsync(
        AIEpicGenerationInput input,
        CancellationToken ct);

    /// <summary>
    /// Generate a list of standalone tasks from a free-form prompt, scoped
    /// to a project and optionally an epic. Each task carries 2-5
    /// acceptance criteria like the project-gen flow.
    /// </summary>
    Task<IReadOnlyList<AIGeneratedTask>> GenerateTaskListAsync(
        AITaskListGenerationInput input,
        CancellationToken ct);

    /// <summary>
    /// Decompose an existing task into a description, refined acceptance
    /// criteria (subtasks), and optional adjusted point estimate. Used by
    /// "AI: break down" on the task drawer.
    /// </summary>
    Task<AITaskBreakdown> BreakdownTaskAsync(
        AITaskBreakdownInput input,
        CancellationToken ct);

    Task<IReadOnlyList<string>> GenerateClarifyingQuestionsAsync(
        string description,
        string projectType,
        CancellationToken ct);

    Task<AIEffortEstimate> EstimateStoryPointsAsync(
        AIEstimationInput input,
        CancellationToken ct);

    Task<AISprintFillPlan> SuggestSprintFillAsync(
        AISprintFillInput input,
        CancellationToken ct);

    /// <summary>
    /// Diagnose the active sprint: titled headline, a paragraph of body,
    /// and 2-3 concrete replan options. Surfaced in the project's AI
    /// Inbox as a durable suggestion the PM can accept / edit / dismiss.
    /// </summary>
    Task<AISprintHealthInsight> GenerateSprintHealthInsightAsync(
        AISprintHealthInput input,
        CancellationToken ct);
}
