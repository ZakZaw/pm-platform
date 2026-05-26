using System.Text.Json;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Tasks.Notifications;

/// <summary>
/// Fired by <see cref="Commands.UpdateTaskStatusCommand"/> whenever a task
/// transitions into Blocked from a non-blocked state. The single handler
/// (<see cref="BlockedCascadeHandler"/>) walks the downstream dependency
/// graph and posts one <see cref="AISuggestion"/> card with the cascade
/// impact (transitive downstream tasks + affected epics + pinned
/// milestones). Mirrors F2-09's Done notification — same wiring point,
/// inverse direction along the edge set.
/// </summary>
public record TaskTransitionedToBlockedNotification(
    Guid TaskId,
    Guid ProjectId,
    Guid? EpicId,
    string TaskKey,
    string TaskTitle,
    string? Reason,
    Guid ByUserId) : INotification;

public class BlockedCascadeHandler(
    IAppDbContext db,
    IAIControlGate aiGate,
    IProjectEventBus events)
    : INotificationHandler<TaskTransitionedToBlockedNotification>
{
    private static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web);

    public async System.Threading.Tasks.Task Handle(
        TaskTransitionedToBlockedNotification n, CancellationToken ct)
    {
        // Off mode: PM still owns the blocker call manually; we just
        // don't volunteer the cascade analysis.
        var mode = await aiGate.GetModeAsync(n.ProjectId, ct);
        if (mode == AIControlMode.Off) return;

        // Pull the project's full task-dep edge set once and run the BFS in
        // memory. Spec calls for <2s on a 100+ task project; in-process
        // BFS dominates that with a single round-trip.
        var edges = await db.TaskDependencies
            .Where(d => d.Task.ProjectId == n.ProjectId)
            .Select(d => new { d.TaskId, d.DependsOnTaskId })
            .ToListAsync(ct);

        var downstream = BlockedCascadeWalker.ForwardClosure(
            edges.Select(e => (e.TaskId, e.DependsOnTaskId)).ToList(),
            n.TaskId);

        if (downstream.Count == 0) return;

        var downstreamIds = downstream.ToList();

        var projectKey = await db.Projects
            .Where(p => p.Id == n.ProjectId)
            .Select(p => p.Key)
            .FirstAsync(ct);

        var affectedTasks = await db.Tasks
            .Where(t => downstreamIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id, t.KeyNum, t.Title,
                Status = t.Status.ToString(),
                t.EpicId,
                Priority = t.Priority.ToString(),
                t.AssigneeId,
            })
            .ToListAsync(ct);

        var affectedEpicIds = affectedTasks
            .Where(t => t.EpicId.HasValue)
            .Select(t => t.EpicId!.Value)
            .Distinct()
            .ToList();

        var affectedEpics = affectedEpicIds.Count == 0
            ? []
            : await db.Epics
                .Where(e => affectedEpicIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Title, e.EndDate })
                .ToListAsync(ct);

        var affectedMilestones = affectedEpicIds.Count == 0
            ? []
            : await db.Milestones
                .Where(m => m.EpicId.HasValue && affectedEpicIds.Contains(m.EpicId!.Value))
                .OrderBy(m => m.Date)
                .Select(m => new { m.Id, m.Title, m.Date })
                .ToListAsync(ct);

        var payload = JsonSerializer.Serialize(new
        {
            triggerTaskId = n.TaskId,
            triggerKey = n.TaskKey,
            blockerReason = n.Reason,
            tasks = affectedTasks.Select(t => new
            {
                taskId = t.Id,
                key = $"{projectKey}-{t.KeyNum}",
                title = t.Title,
                status = t.Status,
                priority = t.Priority,
                epicId = t.EpicId,
                assigneeId = t.AssigneeId,
            }),
            epics = affectedEpics.Select(e => new
            {
                epicId = e.Id,
                title = e.Title,
                endDate = e.EndDate,
            }),
            milestones = affectedMilestones.Select(m => new
            {
                milestoneId = m.Id,
                title = m.Title,
                date = m.Date,
            }),
        }, JsonOpts);

        var taskCount = affectedTasks.Count;
        var msCount = affectedMilestones.Count;
        var body = msCount > 0
            ? $"\"{n.TaskTitle}\" is blocking {taskCount} downstream {(taskCount == 1 ? "task" : "tasks")} across {affectedEpicIds.Count} {(affectedEpicIds.Count == 1 ? "epic" : "epics")}, with {msCount} {(msCount == 1 ? "milestone" : "milestones")} at risk. Review and consider replanning."
            : $"\"{n.TaskTitle}\" is blocking {taskCount} downstream {(taskCount == 1 ? "task" : "tasks")} across {affectedEpicIds.Count} {(affectedEpicIds.Count == 1 ? "epic" : "epics")}. Review and consider replanning.";

        db.AISuggestions.Add(new AISuggestion
        {
            ProjectId = n.ProjectId,
            Kind = "task.blocked.cascade",
            Title = $"{n.TaskKey} blocked — {taskCount} downstream {(taskCount == 1 ? "task" : "tasks")} at risk",
            Body = body,
            PayloadJson = payload,
            Status = "Open",
            CreatedByUserId = n.ByUserId,
            Provider = "system",
            Model = "n/a",
        });
        await db.SaveChangesAsync(ct);

        await events.PublishAsync(n.ProjectId, ProjectEvents.AiSuggestionCreated, new
        {
            kind = "task.blocked.cascade",
            triggerTaskId = n.TaskId,
            downstreamCount = taskCount,
        }, ct);
    }
}

/// <summary>
/// Pure graph algorithms for the blocked-cascade analysis. Kept separate
/// so unit tests don't need DB context.
/// </summary>
public static class BlockedCascadeWalker
{
    /// <summary>
    /// Returns every task that transitively depends on <paramref name="root"/>,
    /// excluding the root itself. Edges are <c>(taskId, dependsOnTaskId)</c>:
    /// the walk follows them forward (root → tasks that have root as a
    /// prerequisite → tasks that have those as prerequisites → …). Cycles
    /// are tolerated; each node visits at most once.
    /// </summary>
    public static HashSet<Guid> ForwardClosure(
        IReadOnlyCollection<(Guid TaskId, Guid DependsOnTaskId)> edges,
        Guid root)
    {
        // Build adjacency keyed by the prerequisite — so a quick lookup
        // gives every task that depends on a given task id.
        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var (taskId, dep) in edges)
        {
            if (!adjacency.TryGetValue(dep, out var list))
                adjacency[dep] = list = [];
            list.Add(taskId);
        }

        var seen = new HashSet<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(root);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!adjacency.TryGetValue(current, out var nexts)) continue;
            foreach (var next in nexts)
            {
                if (next == root) continue; // ignore self-edges on the root
                if (seen.Add(next)) queue.Enqueue(next);
            }
        }

        return seen;
    }
}
