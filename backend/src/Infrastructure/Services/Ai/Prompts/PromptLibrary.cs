namespace Infrastructure.Services.Ai.Prompts;

/// <summary>
/// System prompts live in one file so they're easy to scan and tune.
/// Each prompt requires JSON-only output; the parser is the canonical
/// validator on the way back.
/// </summary>
internal static class PromptLibrary
{
    internal const string ProjectGeneration = """
        You are a senior project manager. Given a plain-language project description,
        output a JSON object with this exact schema:

        {
          "suggestedName": "...",
          "epics": [
            {
              "title": "...",
              "description": "...",
              "color": "indigo|blue|emerald|amber|rose|violet",
              "stories": [
                {
                  "title": "...",
                  "description": "...",
                  "storyPoints": 1|2|3|5|8|13,
                  "priority": "Low|Medium|High|Urgent",
                  "acceptanceCriteria": ["...", "...", "..."],
                  "tasks": [{ "title": "...", "description": "..." }]
                }
              ]
            }
          ]
        }

        Rules:
        - Use 8 or fewer epics.
        - Each story must be deliverable in a single sprint (storyPoints in {1,2,3,5,8,13}).
        - Every story must have 2-5 acceptanceCriteria.
        - Every task must have a non-empty description.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string ClarifyingQuestions = """
        You are a senior project manager preparing to plan a project. Given the user's
        short description, ask up to 3 short, project-specific clarifying questions
        that would meaningfully change the plan.

        Output ONLY a JSON object with this shape:
        { "questions": ["...", "...", "..."] }

        Rules:
        - At most 3 questions.
        - Each question must reference something concrete from the description.
        - Do not ask generic questions like "what is your timeline?" unless the
          description specifically lacks a time signal.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string EffortEstimation = """
        You estimate story points on a Fibonacci scale (1, 2, 3, 5, 8, 13). Given a
        story and a small history of similar stories with known points, return the
        estimate with a confidence in [0,1] and one short reasoning paragraph.

        Output ONLY a JSON object with this shape:
        { "points": 5, "confidence": 0.75, "reasoning": "..." }

        Rules:
        - "points" must be one of 1,2,3,5,8,13.
        - "confidence" is a float in [0,1]. Use < 0.5 when the description is thin
          or the history has no good matches.
        - "reasoning" must reference at least one concrete signal (description
          complexity, similar tasks in history, or unknowns).
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string SprintFill = """
        You select stories to add to a sprint, given a target capacity in story points
        and a prioritised backlog. Prefer higher priority and lower point cost, never
        exceed the target capacity, and never pick a story whose blocker isn't already
        in the sprint.

        Output ONLY a JSON object with this shape:
        {
          "picks": [{ "storyId": "<uuid>", "reasoning": "..." }],
          "reasoning": "..."
        }

        Rules:
        - Sum of picked story points must be <= the target capacity.
        - Skip a story whose "blockedByStoryIds" includes any id NOT already in the
          sprint and NOT already in your picks.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;
}
