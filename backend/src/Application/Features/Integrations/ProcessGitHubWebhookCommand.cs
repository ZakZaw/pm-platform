using System.Text.Json;
using Application.Common;
using Application.Features.Tasks.Notifications;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;
using TaskEntity = Domain.Entities.Task;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — process an inbound GitHub webhook. The whole pipeline lives
/// here because signature verification needs the repo's secret, which
/// we only know after locating the <see cref="Integration"/> by the
/// repo in the (already-verified-shape) payload:
///
///   1. Parse the repo full_name from the body.
///   2. Find the integration; unknown repos are silently ignored.
///   3. HMAC-verify the raw bytes against that integration's secret.
///   4. Dispatch by event type, linking branches / PRs / CI back to
///      tasks by the key embedded in the ref / PR title.
///
/// Behaviour (per the F2-23 ACs):
///   • push of a new branch  → linked task moves to InProgress
///   • pull_request merged    → linked task moves to Done
///   • check_run / status     → linked task's CiStatus + CiUrl update
///   • pull_request_review "changes_requested" → task back to InProgress
/// </summary>
public record ProcessGitHubWebhookCommand(string? EventType, byte[] Body, string? Signature)
    : IRequest<Result>;

public class ProcessGitHubWebhookCommandHandler(
    IAppDbContext db, IGitHubService github, IProjectEventBus events, IPublisher publisher)
    : IRequestHandler<ProcessGitHubWebhookCommand, Result>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result> Handle(ProcessGitHubWebhookCommand request, CancellationToken ct)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(request.Body);
        }
        catch (JsonException)
        {
            return Result.Success(); // not JSON → nothing to do, but don't 500
        }

        using (doc)
        {
            var root = doc.RootElement;
            var repo = root.TryGetProperty("repository", out var r)
                       && r.TryGetProperty("full_name", out var fn)
                ? fn.GetString()
                : null;
            if (string.IsNullOrWhiteSpace(repo))
                return Result.Success();

            var integration = await db.Integrations
                .FirstOrDefaultAsync(
                    i => i.Provider == GitProvider.GitHub && i.RepoFullName == repo, ct);
            // Unknown repo → we never linked it; ack so GitHub stops retrying.
            if (integration is null)
                return Result.Success();

            // Signature gate. Everything past this point is trusted.
            if (!github.VerifyWebhookSignature(request.Signature, request.Body, integration.WebhookSecret))
                return Result.Failure(IntegrationErrors.InvalidSignature);

            var projectKey = await db.Projects
                .Where(p => p.Id == integration.ProjectId)
                .Select(p => p.Key)
                .FirstOrDefaultAsync(ct);
            if (string.IsNullOrWhiteSpace(projectKey))
                return Result.Success();

            var changedTaskIds = (request.EventType ?? string.Empty) switch
            {
                "push" => await HandlePushAsync(root, integration, projectKey, ct),
                "pull_request" => await HandlePullRequestAsync(root, integration, projectKey, ct),
                "pull_request_review" => await HandleReviewAsync(root, integration, projectKey, ct),
                "check_run" or "check_suite" => await HandleCheckAsync(root, integration, projectKey, ct),
                "status" => await HandleStatusAsync(root, integration, projectKey, ct),
                _ => [],
            };

            integration.LastEventAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);

            // Real-time board refresh if this delivery touched any task.
            if (changedTaskIds.Count > 0)
            {
                await events.PublishAsync(integration.ProjectId, "board.changed",
                    new { projectId = integration.ProjectId }, ct);
            }

            return Result.Success();
        }
    }

    // push: a new branch whose name carries a task key moves that task
    // to InProgress. We only act on branch creation (created == true) so
    // ordinary commits don't keep yanking the status back.
    private async Task<List<Guid>> HandlePushAsync(
        JsonElement root, Integration integration, string projectKey, CancellationToken ct)
    {
        var created = root.TryGetProperty("created", out var c) && c.ValueKind == JsonValueKind.True;
        if (!created) return [];

        var refName = root.TryGetProperty("ref", out var rf) ? rf.GetString() : null;
        // refs/heads/feat/AT-247-add-login → strip the refs/heads/ prefix.
        if (refName is null || !refName.StartsWith("refs/heads/", StringComparison.Ordinal)) return [];
        var branch = refName["refs/heads/".Length..];

        var task = await ResolveTaskAsync(integration.ProjectId, projectKey,
            GitTaskKeyParser.Parse(branch), ct);
        if (task is null) return [];

        return MoveStatus(task, DomainTaskStatus.InProgress, integration.ConnectedByUserId)
            ? [task.Id]
            : [];
    }

    // pull_request: opened/reopened links the PR to the task; merged
    // closes it; a plain close just records the closed state.
    private async Task<List<Guid>> HandlePullRequestAsync(
        JsonElement root, Integration integration, string projectKey, CancellationToken ct)
    {
        var action = root.TryGetProperty("action", out var a) ? a.GetString() : null;
        if (!root.TryGetProperty("pull_request", out var pr)) return [];

        var number = pr.TryGetProperty("number", out var n) && n.TryGetInt32(out var num) ? num : (int?)null;
        var url = pr.TryGetProperty("html_url", out var h) ? h.GetString() : null;
        var title = pr.TryGetProperty("title", out var t) ? t.GetString() : null;
        var headRef = pr.TryGetProperty("head", out var head) && head.TryGetProperty("ref", out var hr)
            ? hr.GetString()
            : null;
        var merged = pr.TryGetProperty("merged", out var m) && m.ValueKind == JsonValueKind.True;

        // Branch name is the strongest signal; fall back to the PR title.
        var keyRef = GitTaskKeyParser.Parse(headRef) ?? GitTaskKeyParser.Parse(title);
        var task = await ResolveTaskAsync(integration.ProjectId, projectKey, keyRef, ct);
        if (task is null) return [];

        task.PrNumber = number;
        if (!string.IsNullOrWhiteSpace(url)) task.PrUrl = url;

        switch (action)
        {
            case "opened":
            case "reopened":
            case "ready_for_review":
                task.PrState = PullRequestState.Open;
                break;
            case "closed" when merged:
                task.PrState = PullRequestState.Merged;
                MoveStatus(task, DomainTaskStatus.Done, integration.ConnectedByUserId);
                await PublishDoneIfNeededAsync(task, projectKey, integration.ConnectedByUserId, ct);
                break;
            case "closed":
                task.PrState = PullRequestState.Closed;
                break;
            default:
                // synchronize / edited / etc. — keep the link fresh, no status move.
                task.PrState ??= PullRequestState.Open;
                break;
        }

        // The task's PR metadata always changed, so report it touched.
        return [task.Id];
    }

    // pull_request_review: "changes_requested" sends the task back to
    // InProgress so the assignee picks the work back up. Approvals are
    // recorded only by virtue of the delivery stamp.
    private async Task<List<Guid>> HandleReviewAsync(
        JsonElement root, Integration integration, string projectKey, CancellationToken ct)
    {
        var state = root.TryGetProperty("review", out var rv) && rv.TryGetProperty("state", out var s)
            ? s.GetString()
            : null;
        if (!string.Equals(state, "changes_requested", StringComparison.OrdinalIgnoreCase))
            return [];

        var headRef = root.TryGetProperty("pull_request", out var pr) && pr.TryGetProperty("head", out var head)
                      && head.TryGetProperty("ref", out var hr)
            ? hr.GetString()
            : null;
        var task = await ResolveTaskAsync(integration.ProjectId, projectKey,
            GitTaskKeyParser.Parse(headRef), ct);
        if (task is null) return [];

        return MoveStatus(task, DomainTaskStatus.InProgress, integration.ConnectedByUserId)
            ? [task.Id]
            : [];
    }

    // check_run / check_suite: roll the conclusion into the linked task's
    // CI badge. The event carries the associated PR numbers, which we
    // match to the task's PrNumber.
    private async Task<List<Guid>> HandleCheckAsync(
        JsonElement root, Integration integration, string projectKey, CancellationToken ct)
    {
        var node = root.TryGetProperty("check_run", out var cr) ? cr
            : root.TryGetProperty("check_suite", out var cs) ? cs
            : (JsonElement?)null;
        if (node is not { } check) return [];

        var status = check.TryGetProperty("status", out var st) ? st.GetString() : null;
        var conclusion = check.TryGetProperty("conclusion", out var cc) ? cc.GetString() : null;
        var url = check.TryGetProperty("html_url", out var h) ? h.GetString()
            : check.TryGetProperty("details_url", out var du) ? du.GetString()
            : null;
        var ci = MapCheckStatus(status, conclusion);

        // Associated PR numbers live on the check node.
        var prNumbers = new List<int>();
        if (check.TryGetProperty("pull_requests", out var prs) && prs.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in prs.EnumerateArray())
                if (p.TryGetProperty("number", out var n) && n.TryGetInt32(out var num))
                    prNumbers.Add(num);
        }
        if (prNumbers.Count == 0) return [];

        var tasks = await db.Tasks
            .Where(t => t.ProjectId == integration.ProjectId
                     && t.PrNumber != null && prNumbers.Contains(t.PrNumber.Value))
            .ToListAsync(ct);
        foreach (var task in tasks)
        {
            task.CiStatus = ci;
            if (!string.IsNullOrWhiteSpace(url)) task.CiUrl = url;
        }
        return tasks.Select(t => t.Id).ToList();
    }

    // legacy commit-status API: branches[] carry the key, state is the
    // CI result.
    private async Task<List<Guid>> HandleStatusAsync(
        JsonElement root, Integration integration, string projectKey, CancellationToken ct)
    {
        var state = root.TryGetProperty("state", out var s) ? s.GetString() : null;
        var url = root.TryGetProperty("target_url", out var tu) ? tu.GetString() : null;
        var ci = MapStatusState(state);

        GitTaskKeyParser.TaskKeyRef? keyRef = null;
        if (root.TryGetProperty("branches", out var branches) && branches.ValueKind == JsonValueKind.Array)
        {
            foreach (var b in branches.EnumerateArray())
            {
                if (!b.TryGetProperty("name", out var bn)) continue;
                keyRef = GitTaskKeyParser.Parse(bn.GetString());
                if (keyRef is not null) break;
            }
        }
        var task = await ResolveTaskAsync(integration.ProjectId, projectKey, keyRef, ct);
        if (task is null) return [];

        task.CiStatus = ci;
        if (!string.IsNullOrWhiteSpace(url)) task.CiUrl = url;
        return [task.Id];
    }

    private async Task<TaskEntity?> ResolveTaskAsync(
        Guid projectId, string projectKey, GitTaskKeyParser.TaskKeyRef? keyRef, CancellationToken ct)
    {
        if (keyRef is not { } kr) return null;
        // Guard against cross-project bleed: the key prefix must match
        // the project this repo is linked to.
        if (!string.Equals(kr.ProjectKey, projectKey, StringComparison.OrdinalIgnoreCase))
            return null;
        return await db.Tasks
            .FirstOrDefaultAsync(t => t.ProjectId == projectId && t.KeyNum == kr.KeyNum, ct);
    }

    // Move status via the domain state machine, recording history. No-op
    // when the task is already in the target state.
    private bool MoveStatus(TaskEntity task, DomainTaskStatus target, Guid byUserId)
    {
        if (task.Status == target) return false;
        var change = task.ChangeStatus(target, byUserId, reason: null);
        db.TaskStatusChanges.Add(change);
        return true;
    }

    private async System.Threading.Tasks.Task PublishDoneIfNeededAsync(
        TaskEntity task, string projectKey, Guid byUserId, CancellationToken ct)
    {
        // Mirror UpdateTaskStatusCommand's fan-out so epic auto-complete /
        // dependent-unblock stays consistent when a merge closes a task.
        try
        {
            await publisher.Publish(new TaskTransitionedToDoneNotification(
                TaskId: task.Id,
                ProjectId: task.ProjectId,
                EpicId: task.EpicId,
                SprintId: task.SprintId,
                TaskKey: $"{projectKey}-{task.KeyNum}",
                TaskTitle: task.Title,
                TaskPoints: task.StoryPoints ?? 0,
                ByUserId: byUserId), ct);
        }
        catch { /* automations never roll back the merge-driven close */ }
    }

    private static CiStatus MapCheckStatus(string? status, string? conclusion)
    {
        // While queued / in_progress there's no conclusion yet.
        if (!string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase))
            return CiStatus.Pending;
        return conclusion?.ToLowerInvariant() switch
        {
            "success" => CiStatus.Success,
            "neutral" => CiStatus.Success,
            "skipped" => CiStatus.Success,
            _ => CiStatus.Failure, // failure / timed_out / cancelled / action_required
        };
    }

    private static CiStatus MapStatusState(string? state) => state?.ToLowerInvariant() switch
    {
        "success" => CiStatus.Success,
        "pending" => CiStatus.Pending,
        _ => CiStatus.Failure, // failure / error
    };
}
