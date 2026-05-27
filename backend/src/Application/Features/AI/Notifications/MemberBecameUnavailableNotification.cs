using System.Text.Json;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using Task = System.Threading.Tasks.Task;

namespace Application.Features.AI.Notifications;

/// <summary>
/// F2-13 — fired when a member's contribution capacity disappears.
/// <see cref="Trigger"/> distinguishes the three reasons (OOO,
/// capacity_zero, org_removed) so the handler can stamp the audit
/// trail correctly. When <see cref="OrgId"/> is non-null the handler
/// only walks projects in that org; null means walk every project the
/// member touches.
/// </summary>
public record MemberBecameUnavailableNotification(
    Guid UserId,
    string Trigger,
    Guid? OrgId) : INotification;

public class ReassignmentSuggestionHandler(
    IAppDbContext db,
    IAIControlGate aiGate,
    IProjectEventBus events,
    ILogger<ReassignmentSuggestionHandler> logger)
    : INotificationHandler<MemberBecameUnavailableNotification>
{
    private static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Top N candidates surfaced per task. More than three is just
    /// noise in the UI — the PM either picks the recommended candidate
    /// or wants to override per-task to someone they have in mind.
    /// </summary>
    private const int CandidatesPerTask = 3;

    public async Task Handle(
        MemberBecameUnavailableNotification n, CancellationToken ct)
    {
        try
        {
            await HandleCore(n, ct);
        }
        catch (Exception ex)
        {
            // Never let one bad notification take down the trigger.
            logger.LogError(ex,
                "ReassignmentSuggestionHandler failed for user {UserId} ({Trigger})",
                n.UserId, n.Trigger);
        }
    }

    private async Task HandleCore(
        MemberBecameUnavailableNotification n, CancellationToken ct)
    {
        var leaving = await db.Users
            .Where(u => u.Id == n.UserId)
            .Select(u => new
            {
                u.Id, u.FullName, u.SkillTags, u.OutOfOfficeUntil,
            })
            .FirstOrDefaultAsync(ct);
        if (leaving is null) return;

        // Open tasks owned by the leaving member, scoped by org when
        // the trigger came from org-removal.
        var openTasksQuery = db.Tasks
            .Where(t => t.AssigneeId == n.UserId
                     && t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo);
        if (n.OrgId is { } orgId)
        {
            openTasksQuery = openTasksQuery
                .Where(t => t.Project.OrganizationId == orgId);
        }

        var openTasks = await openTasksQuery
            .Select(t => new
            {
                t.Id, t.ProjectId, t.EpicId, t.KeyNum, t.Title,
                Priority = t.Priority.ToString(),
                Status = t.Status.ToString(),
                t.StoryPoints, t.DueDate,
            })
            .ToListAsync(ct);
        if (openTasks.Count == 0) return;

        // Group the work by project so we can write one AISuggestion
        // per affected project (matching the AISuggestion model).
        var tasksByProject = openTasks
            .GroupBy(t => t.ProjectId)
            .ToList();

        foreach (var group in tasksByProject)
        {
            ct.ThrowIfCancellationRequested();
            await HandleProject(n, leaving.Id, leaving.FullName,
                leaving.SkillTags, group.Key,
                [.. group.Select(g => new ProjectOpenTask(
                    g.Id, g.EpicId, g.KeyNum, g.Title,
                    g.Priority, g.Status, g.StoryPoints, g.DueDate))], ct);
        }
    }

    private async Task HandleProject(
        MemberBecameUnavailableNotification n,
        Guid leavingUserId,
        string leavingUserName,
        string[] leavingSkillTags,
        Guid projectId,
        IReadOnlyList<ProjectOpenTask> tasks,
        CancellationToken ct)
    {
        // AI control gate covers the same opt-out the PM uses for other
        // suggestion kinds. Off means we don't volunteer suggestions
        // even when the trigger fired.
        if (!await aiGate.IsAllowedAsync(projectId, ct)) return;

        var project = await db.Projects
            .Where(p => p.Id == projectId)
            .Select(p => new { p.Id, p.Name, p.Key })
            .FirstOrDefaultAsync(ct);
        if (project is null) return;

        // Active project members other than the leaving one. We don't
        // join org membership: org-removal cleans up that side; a stale
        // project-membership row without org access is rare enough that
        // letting it surface (and letting the PM override) is fine.
        var rawMembers = await (
            from m in db.ProjectMemberships
            join u in db.Users on m.UserId equals u.Id
            where m.ProjectId == projectId
               && m.UserId != leavingUserId
            select new
            {
                u.Id,
                u.FullName,
                u.SkillTags,
                u.CapacityHoursPerWeek,
                u.OutOfOfficeUntil,
            }).ToListAsync(ct);

        // Filter out OOO candidates — they can't take over today.
        var now = DateTime.UtcNow;
        var members = rawMembers
            .Where(m => m.OutOfOfficeUntil is null || m.OutOfOfficeUntil <= now)
            .ToList();
        if (members.Count == 0) return;

        // Pre-load per-candidate aggregates so the per-task scoring stays
        // O(tasks * members) without DB round-trips. We bucket open-tasks
        // by candidate, and done-tasks by (candidate, epic).
        var memberIds = members.Select(m => m.Id).ToList();

        var openLoad = await db.Tasks
            .Where(t => t.ProjectId == projectId
                     && t.AssigneeId != null
                     && memberIds.Contains(t.AssigneeId!.Value)
                     && t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo)
            .GroupBy(t => t.AssigneeId!.Value)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.UserId, g => g.Count, ct);

        // Epic history is keyed by (userId, epicId). Pulling all done
        // rows once is cheaper than N queries per task.
        var epicHistoryRaw = await db.Tasks
            .Where(t => t.ProjectId == projectId
                     && t.AssigneeId != null
                     && memberIds.Contains(t.AssigneeId!.Value)
                     && t.EpicId != null
                     && t.Status == DomainTaskStatus.Done)
            .GroupBy(t => new { UserId = t.AssigneeId!.Value, EpicId = t.EpicId!.Value })
            .Select(g => new { g.Key.UserId, g.Key.EpicId, Count = g.Count() })
            .ToListAsync(ct);
        var epicHistory = epicHistoryRaw
            .GroupBy(r => r.UserId)
            .ToDictionary(
                g => g.Key,
                g => g.ToDictionary(r => r.EpicId, r => r.Count));

        // Per-task: rank candidates, keep top N. Skip a task if no
        // candidate scored > 0 — that means no one is even barely
        // suitable, so the PM should pick manually anyway.
        var leavingSkillSet = leavingSkillTags;
        var taskBlocks = new List<TaskBlock>(tasks.Count);
        foreach (var task in tasks)
        {
            var ranked = new List<(Guid UserId, string FullName, ReassignmentScore Score)>();
            foreach (var m in members)
            {
                openLoad.TryGetValue(m.Id, out var open);
                int done = 0;
                if (task.EpicId is { } epicId
                    && epicHistory.TryGetValue(m.Id, out var byEpic))
                {
                    byEpic.TryGetValue(epicId, out done);
                }

                var score = ReassignmentScorer.Score(new ReassignmentCandidateInput(
                    LeavingMemberSkillTags: leavingSkillSet,
                    CandidateSkillTags: m.SkillTags,
                    CandidateOpenTasksInProject: open,
                    CandidateCapacityHoursPerWeek: m.CapacityHoursPerWeek,
                    CandidateDoneTasksInEpic: done));
                if (score.Composite <= 0) continue;
                ranked.Add((m.Id, m.FullName, score));
            }

            if (ranked.Count == 0) continue;

            var top = ranked
                .OrderByDescending(r => r.Score.Composite)
                .ThenBy(r => r.FullName, StringComparer.Ordinal)
                .Take(CandidatesPerTask)
                .Select(r => new TaskCandidate(
                    r.UserId, r.FullName,
                    r.Score.Composite,
                    r.Score.SkillMatch,
                    r.Score.CapacityHeadroom,
                    r.Score.HistoryFit))
                .ToList();
            taskBlocks.Add(new TaskBlock(
                task.Id,
                $"{project.Key}-{task.KeyNum}",
                task.Title,
                task.Priority,
                task.Status,
                task.StoryPoints,
                task.DueDate,
                top));
        }

        if (taskBlocks.Count == 0) return;

        var payload = JsonSerializer.Serialize(new
        {
            trigger = n.Trigger,
            leavingUserId = leavingUserId,
            leavingUserName = leavingUserName,
            tasks = taskBlocks.Select(b => new
            {
                taskId = b.TaskId,
                key = b.Key,
                title = b.Title,
                priority = b.Priority,
                status = b.Status,
                points = b.StoryPoints,
                dueDate = b.DueDate,
                candidates = b.Candidates.Select(c => new
                {
                    userId = c.UserId,
                    fullName = c.FullName,
                    score = c.Score,
                    skillMatch = c.SkillMatch,
                    capacityHeadroom = c.CapacityHeadroom,
                    historyFit = c.HistoryFit,
                }),
            }),
        }, JsonOpts);

        var title = $"{leavingUserName} unavailable — {taskBlocks.Count} task" +
                    (taskBlocks.Count == 1 ? "" : "s") + " to reassign";
        var body = TriggerSentence(n.Trigger, leavingUserName) +
                   $" Suggested takeovers ranked by skill match, free capacity, and past work in the same epic.";

        db.AISuggestions.Add(new AISuggestion
        {
            ProjectId = projectId,
            Kind = "member.unavailable",
            Title = title,
            Body = body,
            PayloadJson = payload,
            Status = "Open",
            CreatedByUserId = leavingUserId,
            Provider = "system",
            Model = "n/a",
        });

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "member.unavailable.detected",
            ProjectId = projectId,
            UserId = leavingUserId,
            Prompt = JsonSerializer.Serialize(new
            {
                trigger = n.Trigger,
                leavingUserId,
                projectId,
                taskCount = taskBlocks.Count,
            }, JsonOpts),
            Provider = "system",
            Model = "n/a",
            Applied = false,
        });

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(projectId, ProjectEvents.AiSuggestionCreated, new
        {
            kind = "member.unavailable",
            leavingUserId,
            trigger = n.Trigger,
            taskCount = taskBlocks.Count,
        }, ct);
    }

    private static string TriggerSentence(string trigger, string name) => trigger switch
    {
        "ooo" => $"{name} just set themselves out of office.",
        "capacity_zero" => $"{name}'s weekly capacity dropped to zero.",
        "org_removed" => $"{name} was removed from the organisation.",
        _ => $"{name} is no longer available to pick up work.",
    };

    private record ProjectOpenTask(
        Guid Id, Guid? EpicId, int KeyNum, string Title,
        string Priority, string Status, int? StoryPoints, DateTime? DueDate);

    private record TaskBlock(
        Guid TaskId, string Key, string Title,
        string Priority, string Status, int? StoryPoints, DateTime? DueDate,
        IReadOnlyList<TaskCandidate> Candidates);

    private record TaskCandidate(
        Guid UserId, string FullName,
        double Score, double SkillMatch, double CapacityHeadroom, double HistoryFit);
}
