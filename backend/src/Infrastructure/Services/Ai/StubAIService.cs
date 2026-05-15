using Application.Features.AI;
using Application.Interfaces;

namespace Infrastructure.Services.Ai;

/// <summary>
/// No-network fallback used when GEMINI_API_KEY isn't set. Returns
/// plausible canned data so the full wizard / estimation / sprint-fill
/// flows can be exercised locally without a key. Marks itself as the
/// "stub" provider so audit logs make the source obvious.
/// </summary>
public class StubAIService : IAIService
{
    public string ProviderName => "stub";
    public string Model => "stub-v1";

    public Task<AIGeneratedProject> GenerateProjectStructureAsync(
        string description, string environmentType,
        IReadOnlyList<AIClarificationAnswer>? clarifications, CancellationToken ct)
    {
        var name = string.IsNullOrWhiteSpace(description)
            ? "New project"
            : ShortenForTitle(description);

        var project = new AIGeneratedProject(
            name,
            new List<AIGeneratedEpic>
            {
                new("Foundation",
                    "Setup, deployment, and developer onboarding for the project.",
                    "indigo",
                    new List<AIGeneratedStory>
                    {
                        new("Bootstrap the codebase",
                            "Stand up the project skeleton with CI, lint, and a working hello-world.",
                            3, "High",
                            new List<string>
                            {
                                "Repo created and pushed to origin",
                                "CI runs on every push and PR",
                                "README documents how to run locally",
                            },
                            new List<AIGeneratedTask>
                            {
                                new("Initialise repo", "Create the git repo and push the first commit."),
                                new("Add CI workflow", "Set up GitHub Actions for build + test on push."),
                            }),
                        new("Auth & user model",
                            "Pick an auth approach and stand up sign-up / sign-in.",
                            5, "High",
                            new List<string>
                            {
                                "Users can register with email + password",
                                "Sessions persist across reloads",
                                "Wrong password returns a clear error",
                            },
                            new List<AIGeneratedTask>
                            {
                                new("Pick auth strategy", "Decide between custom JWT vs hosted auth (Clerk/Supabase)."),
                                new("Implement sign-up", "Implement the registration endpoint and form."),
                                new("Implement sign-in", "Implement the login endpoint, session handling, and redirect."),
                            }),
                    }),

                new("Core experience",
                    "The primary flow described in the project brief.",
                    "blue",
                    new List<AIGeneratedStory>
                    {
                        new("Define the data model",
                            "Sketch out the core entities and relationships that the rest of the work hangs off.",
                            5, "Medium",
                            new List<string>
                            {
                                "ER diagram covers all core entities",
                                "Migrations apply cleanly to a fresh database",
                                "Seed script populates a representative dev fixture",
                            },
                            new List<AIGeneratedTask>
                            {
                                new("Draft the ER diagram", "Identify entities, relationships, and primary keys."),
                                new("Write the first migration", "Author the EF Core / SQL migration for the core tables."),
                            }),
                        new("Build the main user view",
                            "Build the most visible page users interact with day-to-day.",
                            8, "High",
                            new List<string>
                            {
                                "Page renders for an authenticated user",
                                "Data loads from the API, not a fixture",
                                "Empty state is handled",
                                "Loading state is handled",
                            },
                            new List<AIGeneratedTask>
                            {
                                new("Wire up the data fetch", "Call the API and map the response into the view model."),
                                new("Lay out the page", "Implement the page layout per the design tokens."),
                                new("Handle empty + loading", "Add explicit empty / loading states with copy."),
                            }),
                    }),

                new("Polish & ship",
                    "Pre-launch hardening: docs, telemetry, and a final pass.",
                    "emerald",
                    new List<AIGeneratedStory>
                    {
                        new("Add basic analytics",
                            "Track the critical events so we can tell whether the launch landed.",
                            2, "Medium",
                            new List<string>
                            {
                                "Sign-up event fires on registration",
                                "First action event fires on the main user action",
                                "Events show up in the analytics dashboard",
                            },
                            new List<AIGeneratedTask>
                            {
                                new("Wire up analytics SDK", "Install and initialise the analytics client."),
                                new("Instrument key events", "Emit the events listed in the AC."),
                            }),
                    }),
            });

        return Task.FromResult(project);
    }

    public Task<IReadOnlyList<string>> GenerateClarifyingQuestionsAsync(
        string description, string environmentType, CancellationToken ct)
    {
        // Reference one signal from the description so the question feels
        // less generic; the second question targets scope, the third users.
        var hint = ShortenForTitle(description);
        IReadOnlyList<string> qs = new[]
        {
            $"Who is the primary user of \"{hint}\" — internal team, paying customer, or both?",
            "What's the smallest version of this that you'd consider a launch?",
            "Are there any existing systems (auth, billing, data) this needs to integrate with?",
        };
        return Task.FromResult(qs);
    }

    public Task<AIEffortEstimate> EstimateStoryPointsAsync(
        AIEstimationInput input, CancellationToken ct)
    {
        // Heuristic: count the AC, the description length, and the
        // similar-history average. Snap to Fibonacci.
        var acWeight = Math.Min(input.AcceptanceCriteria.Count, 6);
        var descWeight = Math.Min((input.Description?.Length ?? 0) / 120, 4);
        var historyAvg = input.SimilarHistory.Count > 0
            ? input.SimilarHistory.Average(s => s.Points) : 3.0;
        var raw = (int)Math.Round((acWeight + descWeight + historyAvg) / 1.6);
        var points = SnapToFib(Math.Max(1, raw));

        var confidence = input.SimilarHistory.Count switch
        {
            0 => 0.4,
            < 3 => 0.6,
            _ => 0.75,
        };

        var reasoning = input.SimilarHistory.Count > 0
            ? $"Anchored on {input.SimilarHistory.Count} similar past stories (avg {historyAvg:F1} pts) and the {acWeight} acceptance criteria here."
            : $"No similar history yet, so this is a rough estimate from the {acWeight} acceptance criteria and description size.";

        return Task.FromResult(new AIEffortEstimate(points, confidence, reasoning));
    }

    public Task<AISprintFillPlan> SuggestSprintFillAsync(
        AISprintFillInput input, CancellationToken ct)
    {
        var picks = new List<AISprintFillPick>();
        var inSprint = new HashSet<Guid>(input.AlreadyInSprint);
        var total = 0;
        // Greedy by priority then by ascending points: take the highest
        // priority that still fits and whose blockers are already in.
        var prioOrder = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Urgent"] = 0, ["High"] = 1, ["Medium"] = 2, ["Low"] = 3,
        };

        var sorted = input.Backlog
            .OrderBy(b => prioOrder.GetValueOrDefault(b.Priority, 4))
            .ThenBy(b => b.Points);

        foreach (var story in sorted)
        {
            if (story.Points <= 0) continue;
            if (total + story.Points > input.CapacityPoints) continue;
            if (story.BlockedByStoryIds.Any(b => !inSprint.Contains(b)))
                continue;
            picks.Add(new AISprintFillPick(
                story.StoryId,
                $"{story.Priority} priority, {story.Points} pts — fits the remaining {input.CapacityPoints - total} pt budget."));
            inSprint.Add(story.StoryId);
            total += story.Points;
        }

        var reasoning = picks.Count == 0
            ? "No stories fit the target capacity given current blockers."
            : $"Selected {picks.Count} stories totalling {total} pts of the {input.CapacityPoints} pt target.";
        return Task.FromResult(new AISprintFillPlan(input.CapacityPoints, total, picks, reasoning));
    }

    private static int SnapToFib(int n)
    {
        int[] scale = [1, 2, 3, 5, 8, 13];
        return scale.OrderBy(x => Math.Abs(x - n)).First();
    }

    private static string ShortenForTitle(string s)
    {
        var t = s.Trim();
        if (t.Length == 0) return "New project";
        var firstSentence = t.Split(new[] { '.', '?', '!', '\n' }, 2)[0].Trim();
        if (firstSentence.Length > 60) firstSentence = firstSentence[..60];
        return firstSentence;
    }
}
