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
    private Client? _clientCache;

    public string ProviderName => "gemini";
    public string Model => _settings.Model;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(_settings.GeminiApiKey);

    private Client GetClient()
    {
        if (_clientCache is not null) return _clientCache;
        if (string.IsNullOrWhiteSpace(_settings.GeminiApiKey))
            throw new AINotConfiguredException(
                "AI is not configured. Set GEMINI_API_KEY in the backend environment.");
        _clientCache = new Client(apiKey: _settings.GeminiApiKey);
        return _clientCache;
    }

    public async Task<AIGeneratedProject> GenerateProjectStructureAsync(
        string description, string projectType,
        IReadOnlyList<AIClarificationAnswer>? clarifications, CancellationToken ct)
    {
        var payload = new
        {
            description,
            projectType,
            clarifications = clarifications?.Select(c => new { c.Question, c.Answer }).ToArray()
                ?? [],
        };
        var json = await CallJsonAsync(PromptLibrary.ProjectGeneration, payload, ct);
        return ParseProject(json);
    }

    // F1.5-07 — typed dispatcher. Engineering stays on the existing
    // GenerateProjectStructureAsync path; this method handles the other
    // five project types via type-specific prompts + parsers.
    public async Task<AITypedProjectDraft> GenerateTypedProjectDraftAsync(
        string description, string projectType,
        IReadOnlyList<AIClarificationAnswer>? clarifications, CancellationToken ct)
    {
        var payload = new
        {
            description,
            projectType,
            clarifications = clarifications?.Select(c => new { c.Question, c.Answer }).ToArray()
                ?? [],
        };
        var (prompt, parser) = TypedDispatch(projectType);
        var json = await CallJsonAsync(prompt, payload, ct);
        return parser(json);
    }

    private static (string Prompt, Func<string, AITypedProjectDraft> Parser) TypedDispatch(string type)
    {
        return type.Trim().ToLowerInvariant() switch
        {
            "sales" => (PromptLibrary.SalesProjectGeneration, ParseSales),
            "support" => (PromptLibrary.SupportProjectGeneration, ParseSupport),
            "marketing" => (PromptLibrary.MarketingProjectGeneration, ParseMarketing),
            "operations" => (PromptLibrary.OperationsProjectGeneration, ParseOperations),
            "generic" => (PromptLibrary.GenericProjectGeneration, ParseGeneric),
            _ => throw new AIServiceException(
                $"GenerateTypedProjectDraftAsync does not handle project type '{type}'. " +
                "Engineering must use GenerateProjectStructureAsync."),
        };
    }

    private static AITypedProjectDraft ParseSales(string json)
    {
        var raw = JsonSerializer.Deserialize<RawSalesProject>(json, JsonOpts)
                  ?? throw new AIServiceException("AI sales response was not parseable.");
        return new AISalesProjectDraft(
            raw.SuggestedName ?? "Sales project",
            (raw.Stages ?? []).Select((s, i) => new AISalesStageDraft(
                (s.Name ?? "Stage").Trim(),
                s.Order > 0 ? s.Order : i + 1,
                Math.Clamp(s.DefaultProbability ?? 50, 0, 100))).ToList(),
            (raw.Accounts ?? []).Select(a => new AISalesAccountDraft(
                (a.Name ?? "Account").Trim(),
                TrimOrNull(a.Domain),
                TrimOrNull(a.Industry))).ToList(),
            (raw.Deals ?? []).Select(d => new AISalesDealDraft(
                (d.Name ?? "Deal").Trim(),
                TrimOrNull(d.AccountName),
                d.Value,
                TrimOrNull(d.Currency)?.ToUpperInvariant(),
                TrimOrNull(d.StageName),
                d.Probability.HasValue ? Math.Clamp(d.Probability.Value, 0, 100) : null,
                d.ExpectedClose)).ToList());
    }

    private static AITypedProjectDraft ParseSupport(string json)
    {
        var raw = JsonSerializer.Deserialize<RawSupportProject>(json, JsonOpts)
                  ?? throw new AIServiceException("AI support response was not parseable.");
        return new AISupportProjectDraft(
            raw.SuggestedName ?? "Support project",
            (raw.Queues ?? []).Select(q => new AISupportQueueDraft(
                (q.Name ?? "Queue").Trim(),
                q.SlaMinutes is > 0 ? q.SlaMinutes.Value : 24 * 60)).ToList(),
            (raw.Customers ?? []).Select(c => new AISupportCustomerDraft(
                (c.Name ?? "Customer").Trim(),
                TrimOrNull(c.Email), TrimOrNull(c.Company), TrimOrNull(c.Tier))).ToList(),
            (raw.Tickets ?? []).Select(t => new AISupportTicketDraft(
                (t.Subject ?? "Ticket").Trim(),
                TrimOrNull(t.BodyMd), TrimOrNull(t.QueueName), TrimOrNull(t.CustomerName),
                NormalisePriority(t.Priority))).ToList());
    }

    private static AITypedProjectDraft ParseMarketing(string json)
    {
        var raw = JsonSerializer.Deserialize<RawMarketingProject>(json, JsonOpts)
                  ?? throw new AIServiceException("AI marketing response was not parseable.");
        return new AIMarketingProjectDraft(
            raw.SuggestedName ?? "Marketing project",
            (raw.Campaigns ?? []).Select(c => new AIMarketingCampaignDraft(
                (c.Name ?? "Campaign").Trim(),
                NormaliseChannel(c.Channel),
                TrimOrNull(c.GoalMd),
                c.StartDate, c.EndDate,
                (c.Assets ?? []).Select(a => new AIMarketingAssetDraft(
                    (a.Title ?? "Asset").Trim(),
                    NormaliseAssetType(a.Type),
                    a.PublishDate)).ToList(),
                (c.Tasks ?? []).Select(t => new AIMarketingTaskDraft(
                    (t.Title ?? "Task").Trim(),
                    TrimOrNull(t.AssetTitle),
                    t.DueDate)).ToList())).ToList());
    }

    private static AITypedProjectDraft ParseOperations(string json)
    {
        var raw = JsonSerializer.Deserialize<RawOperationsProject>(json, JsonOpts)
                  ?? throw new AIServiceException("AI operations response was not parseable.");
        return new AIOperationsProjectDraft(
            raw.SuggestedName ?? "Operations project",
            (raw.Workflows ?? []).Select(w => new AIOperationsWorkflowDraft(
                (w.Name ?? "Workflow").Trim(),
                TrimOrNull(w.Description),
                NormaliseRecurrence(w.RecurrenceRule),
                (w.Checklist ?? []).Select(i => new AIOperationsChecklistItemDraft(
                    (i.Title ?? "Item").Trim(),
                    i.Sequential ?? false)).ToList())).ToList());
    }

    private static AITypedProjectDraft ParseGeneric(string json)
    {
        var raw = JsonSerializer.Deserialize<RawGenericProject>(json, JsonOpts)
                  ?? throw new AIServiceException("AI generic response was not parseable.");
        return new AIGenericProjectDraft(
            raw.SuggestedName ?? "Project",
            (raw.Lists ?? []).Select(l => new AIGenericListDraft(
                (l.Name ?? "List").Trim(),
                (l.Tasks ?? []).Select(t => new AIGenericTaskDraft(
                    (t.Title ?? "Task").Trim(),
                    TrimOrNull(t.Description),
                    NormalisePriority(t.Priority))).ToList())).ToList());
    }

    private static string? TrimOrNull(string? s)
    {
        if (s is null) return null;
        var t = s.Trim();
        return string.IsNullOrEmpty(t) ? null : t;
    }

    private static string NormaliseChannel(string? raw)
    {
        var t = raw?.Trim();
        if (string.IsNullOrEmpty(t)) return "Other";
        return t.ToLowerInvariant() switch
        {
            "email" => "Email",
            "social" => "Social",
            "blog" => "Blog",
            "paid" => "Paid",
            "event" => "Event",
            _ => "Other",
        };
    }

    private static string NormaliseAssetType(string? raw)
    {
        var t = raw?.Trim();
        if (string.IsNullOrEmpty(t)) return "Other";
        return t.ToLowerInvariant() switch
        {
            "email" => "Email",
            "socialpost" or "social_post" or "social" => "SocialPost",
            "blogpost" or "blog_post" or "blog" => "BlogPost",
            "ad" => "Ad",
            "image" => "Image",
            "video" => "Video",
            "landingpage" or "landing_page" or "landing" => "LandingPage",
            _ => "Other",
        };
    }

    private static string? NormaliseRecurrence(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw.Trim().ToUpperInvariant();
    }

    public async Task<AIGeneratedEpic> GenerateEpicStructureAsync(
        AIEpicGenerationInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.EpicGeneration, input, ct);
        try
        {
            var raw = JsonSerializer.Deserialize<RawEpic>(json, JsonOpts)
                      ?? throw new AIServiceException("AI response was not a valid epic.");
            return MapEpic(raw);
        }
        catch (JsonException jex)
        {
            throw new AIServiceException("Could not parse AI epic JSON: " + jex.Message, jex);
        }
    }

    public async Task<IReadOnlyList<AIGeneratedTask>> GenerateTaskListAsync(
        AITaskListGenerationInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.TaskListGeneration, input, ct);
        try
        {
            var raw = JsonSerializer.Deserialize<RawTaskList>(json, JsonOpts)
                      ?? throw new AIServiceException("AI response was not a valid task list.");
            return (raw.Tasks ?? []).Select(MapTask).ToList();
        }
        catch (JsonException jex)
        {
            throw new AIServiceException("Could not parse AI task-list JSON: " + jex.Message, jex);
        }
    }

    public async Task<AITaskBreakdown> BreakdownTaskAsync(
        AITaskBreakdownInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.TaskBreakdown, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var desc = root.TryGetProperty("refinedDescription", out var d) ? d.GetString() ?? "" : "";
        var ac = new List<string>();
        if (root.TryGetProperty("acceptanceCriteria", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                var s = el.GetString();
                if (!string.IsNullOrWhiteSpace(s)) ac.Add(s.Trim());
            }
        }
        int? suggested = null;
        if (root.TryGetProperty("suggestedStoryPoints", out var sp) && sp.ValueKind == JsonValueKind.Number)
            suggested = SnapToFib(sp.GetInt32());
        var reasoning = root.TryGetProperty("reasoning", out var r) ? r.GetString() ?? "" : "";
        return new AITaskBreakdown(desc, ac, suggested, reasoning);
    }

    public async Task<IReadOnlyList<string>> GenerateClarifyingQuestionsAsync(
        string description, string projectType, CancellationToken ct)
    {
        var payload = new { description, projectType };
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

    public async Task<AISprintHealthInsight> GenerateSprintHealthInsightAsync(
        AISprintHealthInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.SprintHealth, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var title = root.TryGetProperty("title", out var t) ? t.GetString() ?? "" : "";
        var body = root.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "";
        var confidence = root.TryGetProperty("confidence", out var c) ? c.GetDouble() : 0.5;
        var options = new List<AISprintHealthOption>();
        if (root.TryGetProperty("options", out var arr) && arr.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in arr.EnumerateArray())
            {
                var label = el.TryGetProperty("label", out var l) ? l.GetString() ?? "" : "";
                if (string.IsNullOrWhiteSpace(label)) continue;
                var rec = el.TryGetProperty("recommended", out var r) && r.GetBoolean();
                options.Add(new AISprintHealthOption(label.Trim(), rec));
            }
        }
        return new AISprintHealthInsight(
            title.Trim(), body.Trim(), options, Math.Clamp(confidence, 0, 1));
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
                if (!el.TryGetProperty("taskId", out var sid)
                    && !el.TryGetProperty("storyId", out sid)) continue;
                if (!Guid.TryParse(sid.GetString(), out var sg)) continue;
                var why = el.TryGetProperty("reasoning", out var r) ? r.GetString() ?? "" : "";
                picks.Add(new AISprintFillPick(sg, why));
            }
        }

        // Enforce capacity client-side too — the model occasionally overshoots.
        var pointsByTask = input.Backlog.ToDictionary(b => b.TaskId, b => b.Points);
        var kept = new List<AISprintFillPick>();
        var total = 0;
        foreach (var pick in picks)
        {
            if (!pointsByTask.TryGetValue(pick.TaskId, out var pts)) continue;
            if (total + pts > input.CapacityPoints) continue;
            kept.Add(pick);
            total += pts;
        }

        var overallReasoning = root.TryGetProperty("reasoning", out var rr)
            ? rr.GetString() ?? "" : "";
        return new AISprintFillPlan(input.CapacityPoints, total, kept, overallReasoning);
    }

    public async Task<AIVelocityReplanResult> GenerateVelocityReplanAsync(
        AIVelocityReplanInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.VelocityReplan, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var headline = root.TryGetProperty("headline", out var h)
            ? (h.GetString() ?? "").Trim()
            : string.Empty;

        var cuttableIds = input.CuttableTasks.Select(c => c.TaskId).ToHashSet();
        var memberIds = input.UnderutilizedMembers.Select(m => m.UserId).ToHashSet();
        var milestoneIds = input.DownstreamMilestones.Select(m => m.MilestoneId).ToHashSet();

        AIReplanCutScopeOption? cutScope = null;
        if (root.TryGetProperty("cutScope", out var cs)
            && cs.ValueKind == JsonValueKind.Object)
        {
            var summary = cs.TryGetProperty("summary", out var s)
                ? (s.GetString() ?? "").Trim()
                : string.Empty;
            var ids = ReadGuidArray(cs, "taskIds")
                .Where(id => cuttableIds.Contains(id))
                .ToList();
            var pointsCut = cs.TryGetProperty("pointsCut", out var pc) && pc.TryGetInt32(out var pcv)
                ? pcv
                : input.CuttableTasks
                    .Where(c => ids.Contains(c.TaskId))
                    .Sum(c => c.Points);
            var daysSaved = cs.TryGetProperty("daysSaved", out var ds) && ds.TryGetInt32(out var dsv)
                ? dsv
                : 0;
            if (ids.Count > 0)
            {
                cutScope = new AIReplanCutScopeOption(summary, ids, pointsCut, daysSaved);
            }
        }

        AIReplanAddResourceOption? addResource = null;
        if (root.TryGetProperty("addResource", out var ar)
            && ar.ValueKind == JsonValueKind.Object)
        {
            var summary = ar.TryGetProperty("summary", out var s)
                ? (s.GetString() ?? "").Trim()
                : string.Empty;
            Guid? memberId = null;
            if (ar.TryGetProperty("memberId", out var mid)
                && mid.ValueKind == JsonValueKind.String
                && Guid.TryParse(mid.GetString(), out var mg)
                && memberIds.Contains(mg))
            {
                memberId = mg;
            }
            var reassign = ReadGuidArray(ar, "reassignTaskIds")
                .Where(id => cuttableIds.Contains(id))
                .ToList();
            var daysSaved = ar.TryGetProperty("daysSaved", out var d) && d.TryGetInt32(out var dv)
                ? dv
                : 0;
            // Only emit an addResource option when we got a real member
            // — without one the apply path can't write.
            if (memberId is not null)
            {
                addResource = new AIReplanAddResourceOption(summary, memberId, reassign, daysSaved);
            }
        }

        AIReplanShiftMilestoneOption? shiftMilestone = null;
        if (root.TryGetProperty("shiftMilestone", out var sm)
            && sm.ValueKind == JsonValueKind.Object)
        {
            var summary = sm.TryGetProperty("summary", out var s)
                ? (s.GetString() ?? "").Trim()
                : string.Empty;
            Guid? milestoneId = null;
            if (sm.TryGetProperty("milestoneId", out var mid)
                && mid.ValueKind == JsonValueKind.String
                && Guid.TryParse(mid.GetString(), out var mg)
                && milestoneIds.Contains(mg))
            {
                milestoneId = mg;
            }
            var shiftDays = sm.TryGetProperty("shiftDays", out var sd) && sd.TryGetInt32(out var sdv)
                ? sdv
                : 0;
            if (milestoneId is not null && shiftDays > 0)
            {
                shiftMilestone = new AIReplanShiftMilestoneOption(summary, milestoneId, shiftDays);
            }
        }

        return new AIVelocityReplanResult(headline, cutScope, addResource, shiftMilestone);
    }

    private static IEnumerable<Guid> ReadGuidArray(JsonElement parent, string key)
    {
        if (!parent.TryGetProperty(key, out var arr)
            || arr.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }
        foreach (var el in arr.EnumerateArray())
        {
            if (el.ValueKind == JsonValueKind.String
                && Guid.TryParse(el.GetString(), out var g))
            {
                yield return g;
            }
        }
    }

    public async Task<AISprintRetrospective> GenerateSprintRetrospectiveAsync(
        AISprintRetroInput input, CancellationToken ct)
    {
        var json = await CallJsonAsync(PromptLibrary.SprintRetrospective, input, ct);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        string GetStr(string key) =>
            root.TryGetProperty(key, out var p) ? (p.GetString() ?? "").Trim() : string.Empty;

        var summary = GetStr("summary");
        var whatWentWell = GetStr("whatWentWell");
        var whatDidnt = GetStr("whatDidnt");
        var suggestions = GetStr("suggestions");

        AIRetroNextSprintDraft? draft = null;
        if (root.TryGetProperty("nextSprintDraft", out var dEl)
            && dEl.ValueKind == JsonValueKind.Object)
        {
            var name = dEl.TryGetProperty("name", out var n)
                ? (n.GetString() ?? "").Trim()
                : string.Empty;
            var goal = dEl.TryGetProperty("goal", out var g) && g.ValueKind != JsonValueKind.Null
                ? g.GetString()
                : null;

            // Only keep picks whose id is in the supplied backlog — the
            // prompt forbids invented ids, but enforce it here too.
            var allowed = input.Backlog.Select(b => b.TaskId).ToHashSet();
            var picks = new List<AIRetroDraftPick>();
            if (dEl.TryGetProperty("tasks", out var picksArr)
                && picksArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in picksArr.EnumerateArray())
                {
                    if (!el.TryGetProperty("taskId", out var idEl)) continue;
                    if (!Guid.TryParse(idEl.GetString(), out var taskId)) continue;
                    if (!allowed.Contains(taskId)) continue;
                    var why = el.TryGetProperty("reasoning", out var r)
                        ? (r.GetString() ?? "").Trim()
                        : string.Empty;
                    picks.Add(new AIRetroDraftPick(taskId, why));
                }
            }

            if (!string.IsNullOrWhiteSpace(name) || picks.Count > 0)
            {
                draft = new AIRetroNextSprintDraft(
                    string.IsNullOrWhiteSpace(name) ? "Next sprint" : name,
                    goal,
                    picks);
            }
        }

        return new AISprintRetrospective(
            summary, whatWentWell, whatDidnt, suggestions, draft);
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

        var client = GetClient();
        try
        {
            var response = await client.Models.GenerateContentAsync(
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
            var epics = (raw.Epics ?? []).Select(MapEpic).ToList();
            return new AIGeneratedProject(raw.SuggestedName ?? "New project", epics);
        }
        catch (JsonException jex)
        {
            throw new AIServiceException("Could not parse AI project JSON: " + jex.Message, jex);
        }
    }

    private static AIGeneratedEpic MapEpic(RawEpic e) => new(
        e.Title ?? "Untitled epic",
        e.Description ?? string.Empty,
        e.Color,
        (e.Tasks ?? []).Select(MapTask).ToList());

    private static AIGeneratedTask MapTask(RawTask t) => new(
        t.Title ?? "Untitled task",
        t.Description ?? string.Empty,
        SnapToFib(t.StoryPoints ?? 3),
        NormalisePriority(t.Priority),
        (t.AcceptanceCriteria ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList());

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
        public List<RawTask>? Tasks { get; set; }
    }
    private sealed class RawTask
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public int? StoryPoints { get; set; }
        public string? Priority { get; set; }
        public List<string>? AcceptanceCriteria { get; set; }
    }
    private sealed class RawTaskList
    {
        public List<RawTask>? Tasks { get; set; }
    }

    // ---------- F1.5-07 typed-project raw shapes ----------

    private sealed class RawSalesProject
    {
        public string? SuggestedName { get; set; }
        public List<RawSalesStage>? Stages { get; set; }
        public List<RawSalesAccount>? Accounts { get; set; }
        public List<RawSalesDeal>? Deals { get; set; }
    }
    private sealed class RawSalesStage
    {
        public string? Name { get; set; }
        public int Order { get; set; }
        public int? DefaultProbability { get; set; }
    }
    private sealed class RawSalesAccount
    {
        public string? Name { get; set; }
        public string? Domain { get; set; }
        public string? Industry { get; set; }
    }
    private sealed class RawSalesDeal
    {
        public string? Name { get; set; }
        public string? AccountName { get; set; }
        public decimal? Value { get; set; }
        public string? Currency { get; set; }
        public string? StageName { get; set; }
        public int? Probability { get; set; }
        public DateTime? ExpectedClose { get; set; }
    }

    private sealed class RawSupportProject
    {
        public string? SuggestedName { get; set; }
        public List<RawSupportQueue>? Queues { get; set; }
        public List<RawSupportCustomer>? Customers { get; set; }
        public List<RawSupportTicket>? Tickets { get; set; }
    }
    private sealed class RawSupportQueue
    {
        public string? Name { get; set; }
        public int? SlaMinutes { get; set; }
    }
    private sealed class RawSupportCustomer
    {
        public string? Name { get; set; }
        public string? Email { get; set; }
        public string? Company { get; set; }
        public string? Tier { get; set; }
    }
    private sealed class RawSupportTicket
    {
        public string? Subject { get; set; }
        public string? BodyMd { get; set; }
        public string? QueueName { get; set; }
        public string? CustomerName { get; set; }
        public string? Priority { get; set; }
    }

    private sealed class RawMarketingProject
    {
        public string? SuggestedName { get; set; }
        public List<RawMarketingCampaign>? Campaigns { get; set; }
    }
    private sealed class RawMarketingCampaign
    {
        public string? Name { get; set; }
        public string? Channel { get; set; }
        public string? GoalMd { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public List<RawMarketingAsset>? Assets { get; set; }
        public List<RawMarketingTask>? Tasks { get; set; }
    }
    private sealed class RawMarketingAsset
    {
        public string? Title { get; set; }
        public string? Type { get; set; }
        public DateTime? PublishDate { get; set; }
    }
    private sealed class RawMarketingTask
    {
        public string? Title { get; set; }
        public string? AssetTitle { get; set; }
        public DateTime? DueDate { get; set; }
    }

    private sealed class RawOperationsProject
    {
        public string? SuggestedName { get; set; }
        public List<RawOperationsWorkflow>? Workflows { get; set; }
    }
    private sealed class RawOperationsWorkflow
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? RecurrenceRule { get; set; }
        public List<RawOperationsItem>? Checklist { get; set; }
    }
    private sealed class RawOperationsItem
    {
        public string? Title { get; set; }
        public bool? Sequential { get; set; }
    }

    private sealed class RawGenericProject
    {
        public string? SuggestedName { get; set; }
        public List<RawGenericList>? Lists { get; set; }
    }
    private sealed class RawGenericList
    {
        public string? Name { get; set; }
        public List<RawGenericTask>? Tasks { get; set; }
    }
    private sealed class RawGenericTask
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Priority { get; set; }
    }
}

public class AIServiceException : Exception
{
    public AIServiceException(string message) : base(message) { }
    public AIServiceException(string message, Exception inner) : base(message, inner) { }
}

/// <summary>
/// Thrown when the AI provider has no API key configured. Distinct from
/// AIServiceException so command handlers can map it to AI.NotConfigured
/// (503) and surface a precise error to the user.
/// </summary>
public class AINotConfiguredException : AIServiceException
{
    public AINotConfiguredException(string message) : base(message) { }
}
