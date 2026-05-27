using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

/// <summary>
/// F2-13 — apply a batch of reassignments off a "member.unavailable"
/// suggestion. The PM either accepts the top candidate for every task
/// (bulk) or overrides specific ones via <paramref name="Picks"/>.
/// When a pick references a task or user the original payload doesn't
/// mention, the pick is dropped — the card's payload is the
/// trust boundary.
/// </summary>
public record ApplyReassignmentsCommand(
    Guid SuggestionId,
    IReadOnlyList<ReassignmentPick>? Picks) : IRequest<Result<AISuggestionDto>>;

public record ReassignmentPick(Guid TaskId, Guid NewAssigneeId);

public class ApplyReassignmentsCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<ApplyReassignmentsCommand, Result<AISuggestionDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AISuggestionDto>> Handle(
        ApplyReassignmentsCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AISuggestionDto>(AuthErrors.NotAuthenticated);

        var suggestion = await db.AISuggestions
            .FirstOrDefaultAsync(s => s.Id == request.SuggestionId, ct);
        if (suggestion is null)
            return Result.Failure<AISuggestionDto>(AIErrors.RequestNotFound);
        if (suggestion.Kind != "member.unavailable")
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);
        if (suggestion.Status != "Open")
            return Result.Failure<AISuggestionDto>(AIErrors.RequestAlreadyApplied);
        if (string.IsNullOrWhiteSpace(suggestion.PayloadJson))
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

        ReassignmentPayload payload;
        try
        {
            payload = JsonSerializer.Deserialize<ReassignmentPayload>(
                suggestion.PayloadJson!, JsonOpts)
                ?? throw new JsonException("empty");
        }
        catch (JsonException)
        {
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);
        }

        // Build the resolved pick set:
        //   1. Start with bulk defaults (each task -> its top candidate).
        //   2. Override with any explicit Picks that reference a task
        //      AND a candidate from that task's candidate list.
        var resolved = new Dictionary<Guid, Guid>();
        foreach (var t in payload.Tasks ?? [])
        {
            var top = t.Candidates?.FirstOrDefault();
            if (top is null) continue;
            resolved[t.TaskId] = top.UserId;
        }

        if (request.Picks is { Count: > 0 })
        {
            // Index candidate sets by task so we can reject overrides
            // that reference a stranger.
            var allowedByTask = (payload.Tasks ?? [])
                .ToDictionary(
                    t => t.TaskId,
                    t => (t.Candidates ?? new List<PayloadCandidate>())
                        .Select(c => c.UserId).ToHashSet());

            foreach (var pick in request.Picks)
            {
                if (!allowedByTask.TryGetValue(pick.TaskId, out var allowed)) continue;
                if (!allowed.Contains(pick.NewAssigneeId)) continue;
                resolved[pick.TaskId] = pick.NewAssigneeId;
            }
        }

        if (resolved.Count == 0)
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

        var taskIds = resolved.Keys.ToList();
        var tasks = await db.Tasks
            .Where(t => taskIds.Contains(t.Id)
                     && t.ProjectId == suggestion.ProjectId
                     && t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo)
            .ToListAsync(ct);

        // Sanity-check the chosen assignees are still on the project.
        var assigneeIds = resolved.Values.Distinct().ToList();
        var validAssignees = await db.ProjectMemberships
            .Where(m => m.ProjectId == suggestion.ProjectId
                     && assigneeIds.Contains(m.UserId))
            .Select(m => m.UserId)
            .ToListAsync(ct);
        var validAssigneeSet = validAssignees.ToHashSet();

        var applied = new List<object>();
        var skipped = new List<object>();
        foreach (var t in tasks)
        {
            if (!resolved.TryGetValue(t.Id, out var newAssignee))
            {
                skipped.Add(new { taskId = t.Id, reason = "no_pick" });
                continue;
            }
            if (!validAssigneeSet.Contains(newAssignee))
            {
                skipped.Add(new { taskId = t.Id, reason = "assignee_not_on_project" });
                continue;
            }
            applied.Add(new
            {
                taskId = t.Id,
                previousAssigneeId = t.AssigneeId,
                newAssigneeId = newAssignee,
            });
            t.AssigneeId = newAssignee;
        }

        if (applied.Count == 0)
            return Result.Failure<AISuggestionDto>(AIErrors.EmptyResult);

        suggestion.Status = "Accepted";
        suggestion.ActedAt = DateTime.UtcNow;
        suggestion.ActedByUserId = userId;

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "member.unavailable.apply",
            UserId = userId,
            ProjectId = suggestion.ProjectId,
            Prompt = JsonSerializer.Serialize(new
            {
                suggestionId = suggestion.Id,
                trigger = payload.Trigger,
                leavingUserId = payload.LeavingUserId,
                pickedTaskCount = applied.Count,
            }, JsonOpts),
            BeforeStateJson = JsonSerializer.Serialize(new { applied, skipped }, JsonOpts),
            AfterStateJson = JsonSerializer.Serialize(new
            {
                reassignments = applied,
                skipped,
            }, JsonOpts),
            Provider = "system",
            Model = "n/a",
            Applied = true,
            AppliedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(suggestion.ProjectId, ProjectEvents.AiSuggestionCreated, new
        {
            kind = suggestion.Kind,
            suggestionId = suggestion.Id,
            status = suggestion.Status,
            reassigned = applied.Count,
        }, ct);

        var projectType = await db.Projects
            .Where(p => p.Id == suggestion.ProjectId)
            .Select(p => p.Type.ToString())
            .FirstAsync(ct);

        return Result.Success(new AISuggestionDto(
            suggestion.Id, suggestion.ProjectId, projectType,
            suggestion.Kind, suggestion.Title, suggestion.Body,
            suggestion.PayloadJson, suggestion.Status,
            suggestion.CreatedAt, suggestion.ActedAt, suggestion.Provider));
    }

    private sealed class ReassignmentPayload
    {
        public string? Trigger { get; set; }
        public Guid LeavingUserId { get; set; }
        public string? LeavingUserName { get; set; }
        public List<PayloadTask>? Tasks { get; set; }
    }

    private sealed class PayloadTask
    {
        public Guid TaskId { get; set; }
        public string? Key { get; set; }
        public string? Title { get; set; }
        public List<PayloadCandidate>? Candidates { get; set; }
    }

    private sealed class PayloadCandidate
    {
        public Guid UserId { get; set; }
        public string? FullName { get; set; }
        public double Score { get; set; }
    }
}
