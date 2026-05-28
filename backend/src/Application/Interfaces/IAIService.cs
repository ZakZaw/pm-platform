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

    /// <summary>
    /// F2-11 — Post-close retrospective. Returns four narrative fields
    /// the PM can edit, plus an optional <see cref="AIRetroNextSprintDraft"/>
    /// that picks backlog items by task id (so applying the draft never
    /// silently invents new tasks).
    /// </summary>
    Task<AISprintRetrospective> GenerateSprintRetrospectiveAsync(
        AISprintRetroInput input,
        CancellationToken ct);

    /// <summary>
    /// F2-12 — Three concrete replan options (cut scope / add
    /// resource / shift milestone) for an in-flight sprint whose pace
    /// is projected to miss its commitment. The caller pre-picks
    /// candidate ids; the model picks from them and the parser strips
    /// any id not in the candidate list.
    /// </summary>
    Task<AIVelocityReplanResult> GenerateVelocityReplanAsync(
        AIVelocityReplanInput input,
        CancellationToken ct);

    /// <summary>
    /// F2-19 — draft a meeting agenda from project context. The model
    /// returns a markdown body with 3-7 bullet items and an estimated
    /// run length per item. The organiser can edit or replace it before
    /// scheduling — we don't gate scheduling on AI being configured.
    /// </summary>
    Task<AIMeetingAgenda> GenerateMeetingAgendaAsync(
        AIMeetingAgendaInput input,
        CancellationToken ct);

    /// <summary>
    /// F2-22 — post-meeting processing. Given the transcript + attendee
    /// list, returns a TL;DR, the meeting's decisions / open questions
    /// / blockers, and draft action items with owner-name + priority +
    /// due-in-days. The caller persists drafts; nothing is auto-created.
    /// </summary>
    Task<AIMeetingProcessingResult> ProcessMeetingTranscriptAsync(
        AIMeetingProcessingInput input,
        CancellationToken ct);
}
