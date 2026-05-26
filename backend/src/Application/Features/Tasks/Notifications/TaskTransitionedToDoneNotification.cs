using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Tasks.Notifications;

/// <summary>
/// Fired by <see cref="Commands.UpdateTaskStatusCommand"/> whenever a task
/// transitions into <see cref="DomainTaskStatus.Done"/> (and the prior
/// status was something else). Three handlers consume it independently:
///
/// <list type="bullet">
///   <item><see cref="EpicProgressOnTaskDoneHandler"/> — auto-completes
///     the parent epic when its last task closes.</item>
///   <item><see cref="UnblockDependentsOnTaskDoneHandler"/> — writes
///     <see cref="AISuggestion"/> cards for every Blocked task that was
///     waiting on this one (gated by <see cref="IAIControlGate"/>).</item>
///   <item><see cref="SprintGoalProgressOnTaskDoneHandler"/> — records
///     a goal-progress activity entry when the sprint clears 80% or
///     100% completion thresholds. Channel post lands when channels
///     ship in F2-16.</item>
/// </list>
///
/// All handlers swallow their own errors — a partial failure in one
/// shouldn't roll back the status change that fired the notification.
/// </summary>
public record TaskTransitionedToDoneNotification(
    Guid TaskId,
    Guid ProjectId,
    Guid? EpicId,
    Guid? SprintId,
    string TaskKey,
    string TaskTitle,
    int TaskPoints,
    Guid ByUserId) : INotification;

internal static class TaskDoneAuditUtils
{
    public static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web);
}

// ---------------------------------------------------------------------------
// Handler 1 — epic auto-complete
// ---------------------------------------------------------------------------

public class EpicProgressOnTaskDoneHandler(
    IAppDbContext db,
    IActivityRecorder activity)
    : INotificationHandler<TaskTransitionedToDoneNotification>
{
    public async System.Threading.Tasks.Task Handle(
        TaskTransitionedToDoneNotification n, CancellationToken ct)
    {
        if (n.EpicId is not { } epicId) return;

        var epic = await db.Epics
            .Where(e => e.Id == epicId && e.ArchivedAt == null)
            .Select(e => new { e.Id, e.Status, e.ProjectId, e.Title, ProjectOrgId = e.Project.OrganizationId })
            .FirstOrDefaultAsync(ct);
        if (epic is null || epic.Status == EpicStatus.Done) return;

        // Count outstanding work in the epic. WontDo counts as resolved —
        // the task is closed even if it never shipped, so the epic can
        // close once everything is in a terminal state.
        var open = await db.Tasks
            .Where(t => t.EpicId == epicId)
            .CountAsync(t => t.Status != DomainTaskStatus.Done
                          && t.Status != DomainTaskStatus.WontDo, ct);
        if (open > 0) return;

        var any = await db.Tasks.AnyAsync(t => t.EpicId == epicId, ct);
        if (!any) return; // Empty epic — don't auto-close.

        var managed = await db.Epics.FirstAsync(e => e.Id == epicId, ct);
        managed.Status = EpicStatus.Done;
        await db.SaveChangesAsync(ct);

        activity.Record(
            orgId: epic.ProjectOrgId,
            projectId: epic.ProjectId,
            actorId: n.ByUserId,
            verb: ActivityVerb.EpicCompleted,
            targetType: "Epic",
            targetId: epic.Id,
            summary: $"completed epic {epic.Title} (every task done)");
        await db.SaveChangesAsync(ct);
    }
}

// ---------------------------------------------------------------------------
// Handler 2 — unblock dependents (AI suggestion card)
// ---------------------------------------------------------------------------

public class UnblockDependentsOnTaskDoneHandler(
    IAppDbContext db,
    IAIControlGate aiGate,
    INotificationService notifications,
    IProjectEventBus events)
    : INotificationHandler<TaskTransitionedToDoneNotification>
{
    public async System.Threading.Tasks.Task Handle(
        TaskTransitionedToDoneNotification n, CancellationToken ct)
    {
        // Find every Blocked task that was waiting on the one that just
        // closed. We surface a suggestion regardless of why they're
        // blocked — if a dependency closes, the PM should at least
        // reconsider whether the dependent can move.
        var blockedDependents = await db.TaskDependencies
            .Where(d => d.DependsOnTaskId == n.TaskId
                     && d.Task.Status == DomainTaskStatus.Blocked)
            .Select(d => new
            {
                d.TaskId,
                d.Task.Title,
                d.Task.AssigneeId,
                d.Task.KeyNum,
                d.Task.ProjectId,
            })
            .ToListAsync(ct);
        if (blockedDependents.Count == 0) return;

        // Off mode: blocked-task automation is silent. The PM can still
        // re-open blocked tasks manually; we just don't volunteer a
        // suggestion card.
        var mode = await aiGate.GetModeAsync(n.ProjectId, ct);
        if (mode == AIControlMode.Off) return;

        var project = await db.Projects
            .Where(p => p.Id == n.ProjectId)
            .Select(p => new { p.Key, p.OrganizationId })
            .FirstAsync(ct);

        foreach (var blocked in blockedDependents)
        {
            var blockedKey = $"{project.Key}-{blocked.KeyNum}";
            var payload = JsonSerializer.Serialize(new
            {
                blockedTaskId = blocked.TaskId,
                blockedKey,
                triggerTaskId = n.TaskId,
                triggerKey = n.TaskKey,
                suggestedNextStatus = "InProgress",
            }, TaskDoneAuditUtils.JsonOpts);

            db.AISuggestions.Add(new AISuggestion
            {
                ProjectId = n.ProjectId,
                Kind = "task.unblock",
                Title = $"{blockedKey} can move — {n.TaskKey} is done",
                Body = $"\"{n.TaskTitle}\" closed. \"{blocked.Title}\" was blocked on it — consider moving it back to In Progress.",
                PayloadJson = payload,
                Status = "Open",
                CreatedByUserId = n.ByUserId,
                Provider = "system",
                Model = "n/a",
            });

            // Ping the blocked task's assignee directly when there is one
            // so the unblock signal isn't only visible inside the AI inbox.
            if (blocked.AssigneeId is { } assignee && project.OrganizationId is { } orgId)
            {
                notifications.Enqueue(
                    userId: assignee,
                    orgId: orgId,
                    projectId: n.ProjectId,
                    actorId: n.ByUserId,
                    kind: NotificationKind.TaskUnblocked,
                    title: $"{blockedKey} is no longer blocked",
                    bodyMd: $"{n.TaskKey} closed, so \"{blocked.Title}\" can move forward.",
                    targetType: "Task",
                    targetId: blocked.TaskId);
            }
        }
        await db.SaveChangesAsync(ct);

        await events.PublishAsync(n.ProjectId, ProjectEvents.AiSuggestionCreated, new
        {
            kind = "task.unblock",
            triggerTaskId = n.TaskId,
            count = blockedDependents.Count,
        }, ct);
    }
}

// ---------------------------------------------------------------------------
// Handler 3 — sprint goal progress
// ---------------------------------------------------------------------------

public class SprintGoalProgressOnTaskDoneHandler(
    IAppDbContext db,
    IActivityRecorder activity)
    : INotificationHandler<TaskTransitionedToDoneNotification>
{
    public async System.Threading.Tasks.Task Handle(
        TaskTransitionedToDoneNotification n, CancellationToken ct)
    {
        if (n.SprintId is not { } sprintId) return;

        var sprint = await db.Sprints
            .Where(s => s.Id == sprintId && s.Status == SprintStatus.Active)
            .Select(s => new
            {
                s.Id, s.Name, s.ProjectId,
                ProjectOrgId = s.Project.OrganizationId,
            })
            .FirstOrDefaultAsync(ct);
        if (sprint is null) return;

        // Recompute points-based progress. Points are nullable on Task —
        // unestimated tasks contribute 0 to both sides, which means
        // unestimated work effectively can't tip a sprint over a
        // threshold by itself. That's fine for now; the next pass at
        // velocity will tighten this.
        var stats = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .GroupBy(t => t.Status)
            .Select(g => new { g.Key, Points = g.Sum(t => t.StoryPoints ?? 0) })
            .ToListAsync(ct);
        var total = stats.Sum(s => s.Points);
        if (total == 0) return;
        var done = stats
            .Where(s => s.Key == DomainTaskStatus.Done)
            .Sum(s => s.Points);

        // Fire only on the crossing — repeated done-transitions inside the
        // same band don't spam the activity feed. Subtract the just-closed
        // task's points to recover the prior progress percentage.
        var pct = (int)Math.Round(done * 100.0 / total);
        var pctBefore = (int)Math.Round(
            Math.Max(0, done - n.TaskPoints) * 100.0 / total);

        string? milestone = null;
        if (pct >= 100 && pctBefore < 100) milestone = "100%";
        else if (pct >= 80 && pctBefore < 80) milestone = "80%";

        if (milestone is null) return;

        // Use ActivityLog as the durable celebration entry until channels
        // (F2-16) provide a real surface for the team to see it.
        activity.Record(
            orgId: sprint.ProjectOrgId,
            projectId: sprint.ProjectId,
            actorId: n.ByUserId,
            verb: ActivityVerb.SprintGoalReached,
            targetType: "Sprint",
            targetId: sprint.Id,
            summary: $"sprint {sprint.Name} reached {milestone} of its committed points");
        await db.SaveChangesAsync(ct);
    }
}
