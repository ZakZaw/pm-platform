using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

/// <summary>
/// F2-12 — apply one of the three replan options the PM picked off a
/// "sprint.replan" <see cref="AISuggestion"/>. The handler reads the
/// option's ids straight out of the suggestion's PayloadJson — the
/// scanner already filtered out invented ids on the way in, so the
/// stored payload is the trusted source of truth.
///
/// All writes (entity mutations + suggestion stamping + audit log)
/// happen in a single SaveChangesAsync so the action is atomic per the
/// AC.
/// </summary>
public record ApplyVelocityReplanCommand(Guid SuggestionId, VelocityReplanOption Option)
    : IRequest<Result<AISuggestionDto>>;

public enum VelocityReplanOption
{
    CutScope = 1,
    AddResource = 2,
    ShiftMilestone = 3,
}

public class ApplyVelocityReplanCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IProjectEventBus events)
    : IRequestHandler<ApplyVelocityReplanCommand, Result<AISuggestionDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AISuggestionDto>> Handle(
        ApplyVelocityReplanCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AISuggestionDto>(AuthErrors.NotAuthenticated);

        var suggestion = await db.AISuggestions
            .FirstOrDefaultAsync(s => s.Id == request.SuggestionId, ct);
        if (suggestion is null) return Result.Failure<AISuggestionDto>(AIErrors.RequestNotFound);
        if (suggestion.Kind != "sprint.replan")
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);
        if (suggestion.Status != "Open")
            return Result.Failure<AISuggestionDto>(AIErrors.RequestAlreadyApplied);
        if (string.IsNullOrWhiteSpace(suggestion.PayloadJson))
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

        ReplanPayload payload;
        try
        {
            payload = JsonSerializer.Deserialize<ReplanPayload>(suggestion.PayloadJson!, JsonOpts)
                      ?? throw new JsonException("empty");
        }
        catch (JsonException)
        {
            return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);
        }

        var projectType = await db.Projects
            .Where(p => p.Id == suggestion.ProjectId)
            .Select(p => p.Type)
            .FirstOrDefaultAsync(ct);

        // Per-option writes. We compute a before-state snapshot before
        // mutating, so the audit row carries reversible context.
        string? beforeState;
        string? afterState;
        switch (request.Option)
        {
            case VelocityReplanOption.CutScope:
            {
                if (payload.CutScope is null || payload.CutScope.TaskIds.Count == 0)
                    return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

                var ids = payload.CutScope.TaskIds;
                var tasks = await db.Tasks
                    .Where(t => ids.Contains(t.Id)
                             && t.ProjectId == suggestion.ProjectId
                             && t.SprintId == payload.SprintId
                             && t.Status != DomainTaskStatus.Done
                             && t.Status != DomainTaskStatus.WontDo)
                    .ToListAsync(ct);

                beforeState = JsonSerializer.Serialize(tasks.Select(t => new
                {
                    taskId = t.Id, sprintId = t.SprintId,
                }), JsonOpts);

                foreach (var t in tasks) t.SprintId = null;

                afterState = JsonSerializer.Serialize(new
                {
                    descopedTaskIds = tasks.Select(t => t.Id),
                    sprintId = payload.SprintId,
                }, JsonOpts);
                break;
            }

            case VelocityReplanOption.AddResource:
            {
                if (payload.AddResource is null
                    || payload.AddResource.MemberId is null
                    || payload.AddResource.ReassignTaskIds.Count == 0)
                    return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

                var memberId = payload.AddResource.MemberId.Value;
                // Verify the chosen member is still on the project before
                // bulk-reassigning. Project membership changes between
                // generate and apply happen.
                var memberStillOnProject = await db.ProjectMemberships
                    .AnyAsync(m => m.ProjectId == suggestion.ProjectId
                                && m.UserId == memberId, ct);
                if (!memberStillOnProject)
                    return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

                var ids = payload.AddResource.ReassignTaskIds;
                var tasks = await db.Tasks
                    .Where(t => ids.Contains(t.Id)
                             && t.ProjectId == suggestion.ProjectId
                             && t.SprintId == payload.SprintId
                             && t.Status != DomainTaskStatus.Done
                             && t.Status != DomainTaskStatus.WontDo)
                    .ToListAsync(ct);

                beforeState = JsonSerializer.Serialize(tasks.Select(t => new
                {
                    taskId = t.Id, previousAssigneeId = t.AssigneeId,
                }), JsonOpts);

                foreach (var t in tasks) t.AssigneeId = memberId;

                afterState = JsonSerializer.Serialize(new
                {
                    reassignedTaskIds = tasks.Select(t => t.Id),
                    newAssigneeId = memberId,
                }, JsonOpts);
                break;
            }

            case VelocityReplanOption.ShiftMilestone:
            {
                if (payload.ShiftMilestone is null
                    || payload.ShiftMilestone.MilestoneId is null
                    || payload.ShiftMilestone.ShiftDays <= 0)
                    return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);

                var milestoneId = payload.ShiftMilestone.MilestoneId.Value;
                var milestone = await db.Milestones
                    .FirstOrDefaultAsync(m => m.Id == milestoneId
                                           && m.ProjectId == suggestion.ProjectId, ct);
                if (milestone is null)
                    return Result.Failure<AISuggestionDto>(MilestoneErrors.NotFound);

                beforeState = JsonSerializer.Serialize(new
                {
                    milestoneId, previousDate = milestone.Date,
                }, JsonOpts);

                milestone.Date = milestone.Date.AddDays(payload.ShiftMilestone.ShiftDays);

                afterState = JsonSerializer.Serialize(new
                {
                    milestoneId, newDate = milestone.Date,
                    shiftDays = payload.ShiftMilestone.ShiftDays,
                }, JsonOpts);
                break;
            }

            default:
                return Result.Failure<AISuggestionDto>(AIErrors.InvalidPayload);
        }

        suggestion.Status = "Accepted";
        suggestion.ActedAt = DateTime.UtcNow;
        suggestion.ActedByUserId = userId;

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = $"sprint.replan.apply.{OptionTag(request.Option)}",
            UserId = userId,
            ProjectId = suggestion.ProjectId,
            Prompt = JsonSerializer.Serialize(new
            {
                suggestionId = suggestion.Id,
                option = request.Option.ToString(),
            }, JsonOpts),
            BeforeStateJson = beforeState,
            AfterStateJson = afterState,
            Provider = suggestion.Provider,
            Model = suggestion.Model,
            Applied = true,
            AppliedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        // Surface the resolution so the AI Inbox can drop the open card
        // without polling.
        await events.PublishAsync(suggestion.ProjectId, ProjectEvents.AiSuggestionCreated, new
        {
            kind = suggestion.Kind,
            suggestionId = suggestion.Id,
            status = suggestion.Status,
        }, ct);

        return Result.Success(new AISuggestionDto(
            suggestion.Id, suggestion.ProjectId, projectType.ToString(),
            suggestion.Kind, suggestion.Title, suggestion.Body,
            suggestion.PayloadJson, suggestion.Status,
            suggestion.CreatedAt, suggestion.ActedAt, suggestion.Provider));
    }

    private static string OptionTag(VelocityReplanOption o) => o switch
    {
        VelocityReplanOption.CutScope => "cut_scope",
        VelocityReplanOption.AddResource => "add_resource",
        VelocityReplanOption.ShiftMilestone => "shift_milestone",
        _ => "unknown",
    };

    // Mirrors the shape produced by GenerateVelocityReplanCommand. Kept
    // tolerant: every option is nullable so the parser doesn't choke on
    // a payload that omitted one (the AI is allowed to return only a
    // subset of options).
    private sealed class ReplanPayload
    {
        public Guid SprintId { get; set; }
        public CutScope? CutScope { get; set; }
        public AddResource? AddResource { get; set; }
        public ShiftMilestone? ShiftMilestone { get; set; }
    }

    private sealed class CutScope
    {
        public List<Guid> TaskIds { get; set; } = [];
        public int PointsCut { get; set; }
        public int DaysSaved { get; set; }
    }

    private sealed class AddResource
    {
        public Guid? MemberId { get; set; }
        public List<Guid> ReassignTaskIds { get; set; } = [];
        public int DaysSaved { get; set; }
    }

    private sealed class ShiftMilestone
    {
        public Guid? MilestoneId { get; set; }
        public int ShiftDays { get; set; }
    }
}
