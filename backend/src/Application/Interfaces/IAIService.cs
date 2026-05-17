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
        string environmentType,
        IReadOnlyList<AIClarificationAnswer>? clarifications,
        CancellationToken ct);

    Task<IReadOnlyList<string>> GenerateClarifyingQuestionsAsync(
        string description,
        string environmentType,
        CancellationToken ct);

    Task<AIEffortEstimate> EstimateStoryPointsAsync(
        AIEstimationInput input,
        CancellationToken ct);

    Task<AISprintFillPlan> SuggestSprintFillAsync(
        AISprintFillInput input,
        CancellationToken ct);
}
