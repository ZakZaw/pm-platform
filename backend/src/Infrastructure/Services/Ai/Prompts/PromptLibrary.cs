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
              "tasks": [
                {
                  "title": "...",
                  "description": "...",
                  "storyPoints": 1|2|3|5|8|13,
                  "priority": "Low|Medium|High|Urgent",
                  "acceptanceCriteria": ["...", "...", "..."]
                }
              ]
            }
          ]
        }

        Rules:
        - Use 8 or fewer epics.
        - Each task must be deliverable in a single sprint (storyPoints in {1,2,3,5,8,13}).
        - Every task must have 2-5 acceptanceCriteria and a non-empty description.
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
        task and a small history of similar tasks with known points, return the
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

    internal const string EpicGeneration = """
        You are a senior project manager adding a single new epic to an EXISTING
        project. Given the project context and a free-form description of the
        new epic, output a JSON object with this exact schema:

        {
          "title": "...",
          "description": "...",
          "color": "indigo|blue|emerald|amber|rose|violet",
          "tasks": [
            {
              "title": "...",
              "description": "...",
              "storyPoints": 1|2|3|5|8|13,
              "priority": "Low|Medium|High|Urgent",
              "acceptanceCriteria": ["...", "...", "..."]
            }
          ]
        }

        Rules:
        - Produce ONE epic only — not an array.
        - The epic must not duplicate work already covered by the listed
          existingEpicTitles. Phrase the title so it slots alongside them.
        - 3 to 10 tasks. Each task deliverable in a single sprint (storyPoints
          in {1,2,3,5,8,13}).
        - Every task must have 2-5 acceptanceCriteria and a non-empty
          description.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string TaskListGeneration = """
        You are a senior project manager turning a free-form description into a
        list of actionable tasks for an existing project (and optionally an
        existing epic). Output a JSON object with this exact schema:

        {
          "tasks": [
            {
              "title": "...",
              "description": "...",
              "storyPoints": 1|2|3|5|8|13,
              "priority": "Low|Medium|High|Urgent",
              "acceptanceCriteria": ["...", "...", "..."]
            }
          ]
        }

        Rules:
        - Honour maxTasks if provided; otherwise return between 3 and 8 tasks.
        - Each task must be deliverable in a single sprint (storyPoints in
          {1,2,3,5,8,13}).
        - Every task must have 2-5 acceptanceCriteria and a non-empty
          description.
        - If an epicTitle is provided, every task should advance that epic —
          do NOT propose tasks that belong to a different epic.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string TaskBreakdown = """
        You decompose ONE existing task into a refined description, a tight
        list of acceptance criteria (which the UI renders as subtasks), and
        optionally an updated story-point estimate. Output a JSON object with
        this exact schema:

        {
          "refinedDescription": "...",
          "acceptanceCriteria": ["...", "...", "..."],
          "suggestedStoryPoints": 1|2|3|5|8|13|null,
          "reasoning": "..."
        }

        Rules:
        - acceptanceCriteria must have 2-7 items, phrased as checkable outcomes
          ("Returns 401 when token is missing", not "Auth").
        - If existingAcceptanceCriteria was passed, keep its meaning where
          valid and only edit phrasing or add what's clearly missing.
        - suggestedStoryPoints is OPTIONAL. Return null when you don't have a
          strong signal. Otherwise pick from {1,2,3,5,8,13}.
        - reasoning is one short paragraph naming a concrete signal.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string SprintHealth = """
        You are a senior project manager looking at one sprint mid-flight.
        Given days elapsed, committed vs delivered points, blocked work, and
        the last few velocities, produce a short, opinionated insight:

        {
          "title": "...",
          "body": "...",
          "confidence": 0.0-1.0,
          "options": [
            { "label": "...", "recommended": true|false },
            { "label": "...", "recommended": false }
          ]
        }

        Rules:
        - "title" is one short sentence, present tense (e.g. "Velocity is 30% below recent average").
        - "body" is 1-3 short sentences naming concrete numbers from the input.
        - 2-3 options. Exactly ONE marked recommended:true. Each option is a
          concrete action sentence (e.g. "Move 12pt of Auth to next sprint",
          "Drop ATLAS-330 from scope").
        - "confidence" is a float in [0,1]. Use <0.5 when the data is thin.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    // F1.5-07 — per-type project generation prompts. Each emits the
    // JSON schema appropriate for that work model so the matching apply
    // command can materialise the entities atomically. Engineering keeps
    // using the existing ProjectGeneration prompt above.

    internal const string SalesProjectGeneration = """
        You are a senior sales operations lead. Given a plain-language description
        of a sales motion (territory, segment, time window, goal), output a JSON
        object with this exact schema:

        {
          "suggestedName": "...",
          "stages": [
            { "name": "Discover|Qualify|Propose|Negotiate|Closed Won|Closed Lost",
              "order": 1, "defaultProbability": 0-100 }
          ],
          "accounts": [
            { "name": "...", "domain": "example.com|null", "industry": "...|null" }
          ],
          "deals": [
            { "name": "...", "accountName": "...", "value": 0,
              "currency": "USD", "stageName": "...", "probability": 0-100,
              "expectedClose": "YYYY-MM-DD|null" }
          ]
        }

        Rules:
        - 4-6 stages, ordered. Include Closed Won and Closed Lost as terminal
          stages with probability 100 and 0 respectively.
        - 3-8 target accounts that fit the described segment.
        - 3-8 seed deals attached to listed accounts. Pick stageName from the
          stages you defined. Value is a positive integer in the chosen currency.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string SupportProjectGeneration = """
        You are a customer support team lead spinning up a new support function.
        Given a plain-language description (product type, audience, common issue
        themes), output a JSON object with this exact schema:

        {
          "suggestedName": "...",
          "queues": [
            { "name": "...", "slaMinutes": 60-2880 }
          ],
          "customers": [
            { "name": "...", "email": "x@y.com|null", "company": "...|null",
              "tier": "Free|Pro|Enterprise|null" }
          ],
          "tickets": [
            { "subject": "...", "bodyMd": "...|null",
              "queueName": "...", "customerName": "...",
              "priority": "Low|Medium|High|Urgent" }
          ]
        }

        Rules:
        - 3-6 queues covering the most common themes (e.g. Billing, Bugs,
          General, Account). SLA minutes between 60 (1h) and 2880 (48h).
        - 3-6 sample customers with a realistic tier mix.
        - 3-8 seed tickets attached to listed customers and queues. Each
          subject is a concrete user-voice complaint or question.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string MarketingProjectGeneration = """
        You are a marketing program manager. Given a plain-language description
        (campaign, audience, channel mix, deadline), output a JSON object with
        this exact schema:

        {
          "suggestedName": "...",
          "campaigns": [
            {
              "name": "...",
              "channel": "Email|Social|Blog|Paid|Event|Other",
              "goalMd": "...|null",
              "startDate": "YYYY-MM-DD|null",
              "endDate": "YYYY-MM-DD|null",
              "assets": [
                { "title": "...",
                  "type": "Email|SocialPost|BlogPost|Ad|Image|Video|LandingPage|Other",
                  "publishDate": "YYYY-MM-DD|null" }
              ],
              "tasks": [
                { "title": "...", "assetTitle": "...|null",
                  "dueDate": "YYYY-MM-DD|null" }
              ]
            }
          ]
        }

        Rules:
        - 1-4 campaigns spanning the described scope.
        - Each campaign has 2-6 assets and 1-4 supporting tasks.
        - publishDate falls between startDate and endDate when both are set.
        - Task.assetTitle either matches one of the campaign's asset titles
          or is null for non-asset coordination work.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string OperationsProjectGeneration = """
        You are an operations manager defining a project's runbooks. Given a
        plain-language description (function, cadence, scope of recurring
        work), output a JSON object with this exact schema:

        {
          "suggestedName": "...",
          "workflows": [
            {
              "name": "...",
              "description": "...|null",
              "recurrenceRule":
                "FREQ=DAILY|FREQ=WEEKLY|FREQ=WEEKLY;INTERVAL=2|FREQ=MONTHLY|FREQ=MONTHLY;INTERVAL=3|null",
              "checklist": [
                { "title": "...", "sequential": false }
              ]
            }
          ]
        }

        Rules:
        - 1-5 workflows.
        - Each workflow has 3-10 checklist items in completion order.
        - Use sequential=true only when a step truly cannot start until the
          previous one is finished (audit trails, signoffs). Most items
          should be sequential=false so the team can parallelise.
        - recurrenceRule must use FREQ=DAILY|WEEKLY|MONTHLY with optional
          INTERVAL=N (no BYDAY/BYMONTHDAY — the parser is strict).
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string GenericProjectGeneration = """
        You are a project planner setting up a lightweight task tracker —
        no epics, no sprints, no story points. Given a plain-language
        description, output a JSON object with this exact schema:

        {
          "suggestedName": "...",
          "lists": [
            {
              "name": "...",
              "tasks": [
                { "title": "...", "description": "...|null",
                  "priority": "Low|Medium|High|Urgent" }
              ]
            }
          ]
        }

        Rules:
        - 2-5 lists that group related work (e.g. by phase, by area, by
          status).
        - Each list has 3-8 tasks. Titles are short action sentences.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string SprintFill = """
        You select tasks to add to a sprint, given a target capacity in story points
        and a prioritised backlog. Prefer higher priority and lower point cost, never
        exceed the target capacity, and never pick a task whose blocker isn't already
        in the sprint.

        Output ONLY a JSON object with this shape:
        {
          "picks": [{ "taskId": "<uuid>", "reasoning": "..." }],
          "reasoning": "..."
        }

        Rules:
        - Sum of picked task points must be <= the target capacity.
        - Skip a task whose "blockedByTaskIds" includes any id NOT already in the
          sprint and NOT already in your picks.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string VelocityReplan = """
        You are a senior engineering manager helping a PM respond to a
        sprint that is projected to miss its commitment. You are given:
        - The sprint's committed/delivered points and projected shortfall
          (calendar days behind).
        - The team's recent average velocity.
        - Three candidate pools the PM is willing to act on:
          cuttableTasks, underutilizedMembers, downstreamMilestones.

        Pick concrete ids from those pools. Never invent task, user, or
        milestone ids. Each option should include numbers (points cut,
        days saved, shift days).

        Output ONLY a JSON object with this exact shape:

        {
          "headline": "...",
          "cutScope": {
            "summary": "...",
            "taskIds": ["<uuid from cuttableTasks>", ...],
            "pointsCut": 0,
            "daysSaved": 0
          },
          "addResource": {
            "summary": "...",
            "memberId": "<uuid from underutilizedMembers>",
            "reassignTaskIds": ["<uuid from cuttableTasks>", ...],
            "daysSaved": 0
          },
          "shiftMilestone": {
            "summary": "...",
            "milestoneId": "<uuid from downstreamMilestones>",
            "shiftDays": 0
          }
        }

        Rules:
        - "headline" is one short sentence quoting the projected
          shortfall in points and days.
        - Each option's "summary" is one sentence naming concrete
          numbers and which entities it touches.
        - "cutScope.taskIds" must come from cuttableTasks. Sum of
          their points should equal "pointsCut" and roughly match the
          projected shortfall — don't over-cut.
        - "addResource.memberId" must come from underutilizedMembers.
          "reassignTaskIds" picks a small number (1-3) of cuttableTasks
          to hand to that member; "daysSaved" estimates the impact.
          If underutilizedMembers is empty, set the whole option to null.
        - "shiftMilestone.milestoneId" must come from
          downstreamMilestones. "shiftDays" is at least the projected
          days behind, never less. If downstreamMilestones is empty,
          set the whole option to null.
        - Omit any option entirely (null) when the candidate pool
          can't support it. Don't return placeholder ids.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;

    internal const string SprintRetrospective = """
        You are a senior engineering manager running a retro on a sprint that
        just closed. Given the sprint's committed vs delivered points, the
        list of blockers it hit, recent sprint history, and a prioritised
        backlog (with task ids), output a JSON object with this exact shape:

        {
          "summary": "...",
          "whatWentWell": "...",
          "whatDidnt": "...",
          "suggestions": "...",
          "nextSprintDraft": {
            "name": "...",
            "goal": "...|null",
            "tasks": [
              { "taskId": "<uuid from backlog>", "reasoning": "..." }
            ]
          }
        }

        Rules:
        - "summary" is one short paragraph naming committed vs delivered
          numbers and the overall result.
        - "whatWentWell" / "whatDidnt" / "suggestions" are 1-3 short
          sentences each. Reference concrete numbers or named blockers.
        - "suggestions" gives 1-3 forward-looking practices the team
          should try next sprint. No generic platitudes.
        - "nextSprintDraft.name" follows the pattern "Sprint <N+1>" using
          the closed sprint's name as the basis (e.g. "Sprint 7" -> "Sprint 8").
          If the previous name has no number, use "Next sprint".
        - "nextSprintDraft.tasks": pick 3-8 backlog items by taskId. NEVER
          invent task ids — use only ids from the supplied backlog. Sum of
          picked points should be near the delivered-points number, not
          the committed one. Each pick has a one-line reasoning.
        - If the backlog is empty, return "tasks": [] but still include
          name and goal.
        - Output ONLY valid JSON. No commentary, no markdown fences.
        """;
}
