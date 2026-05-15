using System.Text.Json;
using Application.Features.AI;
using Application.Interfaces;
using Google.GenAI;
using Google.GenAI.Types;
using Infrastructure.Services.Ai.Prompts;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services.Ai;

/// <summary>
/// Real Gemini-backed implementation. Every call sends the prompt as
/// SystemInstruction and the input payload as user content, requests
/// application/json output, parses, and returns the typed shape.
/// Errors and bad JSON bubble up as <see cref="AIServiceException"/>.
/// </summary>
public class GeminiAIService(IOptions<AISettings> options, ILogger<GeminiAIService> logger) : IAIService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private readonly AISettings _settings = options.Value;
    private readonly Client _client = new(apiKey: options.Value.GeminiApiKey
        ?? throw new InvalidOperationException("Gemini API key is required for GeminiAIService."));

    public string ProviderName => "gemini";
    public string Model => _settings.Model;

    public async Task<AIGeneratedProject> GenerateProjectStructureAsync(
        string description, string environmentType,
        IReadOnlyList<AIClarificationAnswer>? clarifications, CancellationToken ct)
    {
        var payload = new
        {
            description,
            environmentType,
            clarifications = clarifications?.Select(c => new { c.Question, c.Answer }).ToArray()
                ?? [],
        };
        var json = await CallJsonAsync(PromptLibrary.ProjectGeneration, payload, ct);
        return ParseProject(json);
    }

    public async Task<IReadOnlyList<string>> GenerateClarifyingQuestionsAsync(
        string description, string environmentType, CancellationToken ct)
    {
        var payload = new { description, environmentType };
        var json = await CallJsonAsync(PromptLibrary.ClarifyingQuestions, payload, ct);
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("questions", out var q) || q.ValueKind != JsonValueKind.Array)
            return [];
        return q.EnumerateArray()
            .Select(e => e.GetString() ?? string.Empty)
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Take(3)
            .ToList();
    }

    public async Task<AIEffortEstimate> EstimateStoryPointsAsync(
        AIEstimationInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.EffortEstimation, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var points = root.TryGetProperty("points", out var p) ? p.GetInt32() : 3;
        var confidence = root.TryGetProperty("confidence", out var c) ? c.GetDouble() : 0.5;
        var reasoning = root.TryGetProperty("reasoning", out var r) ? r.GetString() ?? "" : "";
        return new AIEffortEstimate(SnapToFib(points), Math.Clamp(confidence, 0, 1), reasoning);
    }

    public async Task<AISprintFillPlan> SuggestSprintFillAsync(
        AISprintFillInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.SprintFill, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var picks = new List<AISprintFillPick>();
        if (root.TryGetProperty("picks", out var picksArr) && picksArr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in picksArr.EnumerateArray())
            {
                if (!el.TryGetProperty("storyId", out var sid)) continue;
                if (!Guid.TryParse(sid.GetString(), out var sg)) continue;
                var why = el.TryGetProperty("reasoning", out var r) ? r.GetString() ?? "" : "";
                picks.Add(new AISprintFillPick(sg, why));
            }
        }

        // Enforce capacity client-side too — the model occasionally overshoots.
        var pointsByStory = input.Backlog.ToDictionary(b => b.StoryId, b => b.Points);
        var kept = new List<AISprintFillPick>();
        var total = 0;
        foreach (var pick in picks)
        {
            if (!pointsByStory.TryGetValue(pick.StoryId, out var pts)) continue;
            if (total + pts > input.CapacityPoints) continue;
            kept.Add(pick);
            total += pts;
        }

        var overallReasoning = root.TryGetProperty("reasoning", out var rr)
            ? rr.GetString() ?? "" : "";
        return new AISprintFillPlan(input.CapacityPoints, total, kept, overallReasoning);
    }

    private async Task<string> CallJsonAsync(string systemPrompt, object payload, CancellationToken ct)
    {
        var content = JsonSerializer.Serialize(payload, JsonOpts);
        var config = new GenerateContentConfig
        {
            SystemInstruction = new Content
            {
                Parts = new List<Part> { new() { Text = systemPrompt } },
            },
            Temperature = 0.2,
            ResponseMimeType = "application/json",
        };

        try
        {
            var response = await _client.Models.GenerateContentAsync(
                model: _settings.Model, contents: content, config: config);
            var text = response.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text;
            if (string.IsNullOrWhiteSpace(text))
                throw new AIServiceException("Empty response from Gemini.");
            return text!;
        }
        catch (AIServiceException) { throw; }
        catch (Exception ex)
        {
            logger.LogError(ex, "Gemini call failed for prompt {Prompt}", systemPrompt[..Math.Min(40, systemPrompt.Length)]);
            throw new AIServiceException("Gemini call failed: " + ex.Message, ex);
        }
    }

    private static AIGeneratedProject ParseProject(string json)
    {
        try
        {
            var raw = JsonSerializer.Deserialize<RawProject>(json, JsonOpts)
                      ?? throw new AIServiceException("AI response was not a valid project structure.");
            var epics = (raw.Epics ?? []).Select(e => new AIGeneratedEpic(
                e.Title ?? "Untitled epic",
                e.Description ?? string.Empty,
                e.Color,
                (e.Stories ?? []).Select(s => new AIGeneratedStory(
                    s.Title ?? "Untitled story",
                    s.Description ?? string.Empty,
                    SnapToFib(s.StoryPoints ?? 3),
                    NormalisePriority(s.Priority),
                    (s.AcceptanceCriteria ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList(),
                    (s.Tasks ?? []).Select(t => new AIGeneratedTask(
                        t.Title ?? "Untitled task",
                        t.Description ?? string.Empty)).ToList())).ToList())).ToList();
            return new AIGeneratedProject(raw.SuggestedName ?? "New project", epics);
        }
        catch (JsonException jex)
        {
            throw new AIServiceException("Could not parse AI project JSON: " + jex.Message, jex);
        }
    }

    private static int SnapToFib(int n)
    {
        int[] scale = [1, 2, 3, 5, 8, 13];
        return scale.OrderBy(x => Math.Abs(x - n)).First();
    }

    private static string NormalisePriority(string? p)
    {
        if (string.IsNullOrWhiteSpace(p)) return "Medium";
        var lower = p.Trim().ToLowerInvariant();
        return lower switch
        {
            "urgent" => "Urgent",
            "high" => "High",
            "low" => "Low",
            _ => "Medium",
        };
    }

    private sealed class RawProject
    {
        public string? SuggestedName { get; set; }
        public List<RawEpic>? Epics { get; set; }
    }
    private sealed class RawEpic
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Color { get; set; }
        public List<RawStory>? Stories { get; set; }
    }
    private sealed class RawStory
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public int? StoryPoints { get; set; }
        public string? Priority { get; set; }
        public List<string>? AcceptanceCriteria { get; set; }
        public List<RawTask>? Tasks { get; set; }
    }
    private sealed class RawTask
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
    }
}

public class AIServiceException : Exception
{
    public AIServiceException(string message) : base(message) { }
    public AIServiceException(string message, Exception inner) : base(message, inner) { }
}
