using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

/// <summary>
/// F2-12 — generate an AI replan card for an in-flight sprint whose
/// pace projects to miss the commitment by more than the configured
/// day threshold. Called by the scanner on a daily cadence; can also
/// be triggered manually for testing.
///
/// The handler runs the projection inline so callers don't have to
/// duplicate the math. <see cref="ForceGenerate"/> bypasses the
/// threshold check — only the scanner uses the threshold; manual
/// invocations from the API generate regardless.
/// </summary>
public record GenerateVelocityReplanCommand(Guid SprintId, bool ForceGenerate = true)
    : IRequest<Result<AISuggestionDto>>;

public class GenerateVelocityReplanCommandHandler(
    IAppDbContext db,
    IAIService ai,
    IAIControlGate aiGate)
    : IRequestHandler<GenerateVelocityReplanCommand, Result<AISuggestionDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AISuggestionDto>> Handle(
        GenerateVelocityReplanCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints
            .FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null) return Result.Failure<AISuggestionDto>(SprintErrors.NotFound);
        if (sprint.Status != SprintStatus.Active)
            return Result.Failure<AISuggestionDto>(SprintErrors.NotActive);

        var mode = await aiGate.GetModeAsync(sprint.ProjectId, ct);
        if (mode == AIControlMode.Off)
            return Result.Failure<AISuggestionDto>(AIErrors.DisabledForProject);

        if (!ai.IsConfigured)
            return Result.Failure<AISuggestionDto>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == sprint.ProjectId)
            .Select(p => new { p.Id, p.Name, p.Type })
            .FirstAsync(ct);

        // --- Sprint state -----------------------------------------------------
        var tasks = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .Select(t => new
            {
                t.Id, t.Title, t.Status, t.StoryPoints,
                t.Priority, t.PriorityOrder, t.KeyNum, t.AssigneeId,
            })
            .ToListAsync(ct);
        var committedPts = tasks.Sum(t => t.StoryPoints ?? 0);
        var donePts = tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);
        var sprintLen = Math.Max(1, (sprint.EndDate - sprint.StartDate).Days);
        var elapsed = Math.Clamp((int)(DateTime.UtcNow - sprint.StartDate).TotalDays, 0, sprintLen);

        var recentVelocities = await db.Sprints
            .Where(s => s.ProjectId == sprint.ProjectId
                     && s.Id != sprint.Id
                     && s.FinalVelocity != null)
            .OrderByDescending(s => s.ClosedAt)
            .Take(5)
            .Select(s => s.FinalVelocity!.Value)
            .ToListAsync(ct);

        var projection = VelocityProjection.Project(
            committedPts, donePts, elapsed, sprintLen, recentVelocities);

        // Scanner-only trip wire. Manual generates skip this.
        if (!request.ForceGenerate
            && projection.ProjectedDaysBehind <= VelocityProjection.DefaultDelayThresholdDays)
        {
            return Result.Failure<AISuggestionDto>(AIErrors.EmptyResult);
        }

        var projectKey = await db.Projects
            .Where(p => p.Id == sprint.ProjectId).Select(p => p.Key).FirstAsync(ct);

        // --- Candidate pools the AI may pick from -----------------------------

        // Cuttable: in this sprint, not Done, lowest priority first. Cap
        // at 12 — the AI doesn't need to reason about an unbounded set.
        var cuttable = tasks
            .Where(t => t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo)
            .OrderByDescending(t => t.Priority) // Low > Medium > High > Urgent in enum order
            .ThenByDescending(t => t.PriorityOrder)
            .Take(12)
            .Select(t => new AIReplanCuttable(
                t.Id,
                $"{projectKey}-{t.KeyNum}",
                t.Title,
                t.StoryPoints ?? 0,
                t.Priority.ToString()))
            .ToList();

        // Underutilized: project members whose capacity is set and who
        // aren't currently assigned to >2 active sprint tasks. Crude
        // signal but enough to give the AI a candidate list.
        var membersRaw = await db.ProjectMemberships
            .Where(m => m.ProjectId == project.Id)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => new
            {
                u.Id, u.FullName, u.CapacityHoursPerWeek,
            })
            .ToListAsync(ct);
        var loadByUser = tasks
            .Where(t => t.AssigneeId.HasValue && t.Status == DomainTaskStatus.InProgress)
            .GroupBy(t => t.AssigneeId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
        var underutilized = membersRaw
            .Where(m => m.CapacityHoursPerWeek > 0
                     && (!loadByUser.TryGetValue(m.Id, out var n) || n <= 2))
            .Select(m => new AIReplanMember(m.Id, m.FullName, m.CapacityHoursPerWeek))
            .Take(8)
            .ToList();

        // Downstream milestones: pinned to any epic that has a sprint
        // task, with the soonest due dates.
        var sprintTaskIds = tasks.Select(t => t.Id).ToList();
        var epicIdsForSprintTasks = await db.Tasks
            .Where(t => sprintTaskIds.Contains(t.Id) && t.EpicId != null)
            .Select(t => t.EpicId!.Value)
            .Distinct()
            .ToListAsync(ct);
        var downstreamMilestones = epicIdsForSprintTasks.Count == 0
            ? []
            : await db.Milestones
                .Where(m => m.EpicId.HasValue
                         && epicIdsForSprintTasks.Contains(m.EpicId!.Value)
                         && m.Date >= DateOnly.FromDateTime(DateTime.UtcNow))
                .OrderBy(m => m.Date)
                .Take(6)
                .Select(m => new AIReplanMilestone(m.Id, m.Title, m.Date))
                .ToListAsync(ct);

        // --- Call ------------------------------------------------------------
        var input = new AIVelocityReplanInput(
            ProjectName: project.Name,
            SprintName: sprint.Name,
            DaysElapsed: elapsed,
            DaysTotal: sprintLen,
            CommittedPoints: committedPts,
            DonePoints: donePts,
            ProjectedDelivered: projection.ProjectedDelivered,
            ProjectedShortfallPoints: projection.ProjectedShortfallPoints,
            ProjectedDaysBehind: projection.ProjectedDaysBehind,
            RecentAverageVelocity: projection.RecentAverageVelocity,
            CuttableTasks: cuttable,
            UnderutilizedMembers: underutilized,
            DownstreamMilestones: downstreamMilestones);

        AIVelocityReplanResult result;
        try
        {
            result = await ai.GenerateVelocityReplanAsync(input, ct);
        }
        catch (Exception ex)
        {
            db.AIAuditLogs.Add(new AIAuditLog
            {
                ActionType = "sprint.replan.failed",
                ProjectId = project.Id,
                Prompt = JsonSerializer.Serialize(input, JsonOpts),
                ErrorMessage = ex.Message,
                Provider = ai.ProviderName, Model = ai.Model,
            });
            await db.SaveChangesAsync(ct);
            return Result.Failure<AISuggestionDto>(AIErrors.ProviderFailed);
        }

        // If every option came back null after parsing, there's no
        // actionable card to write. Audit-log and bail.
        if (result.CutScope is null
            && result.AddResource is null
            && result.ShiftMilestone is null)
        {
            db.AIAuditLogs.Add(new AIAuditLog
            {
                ActionType = "sprint.replan.empty",
                ProjectId = project.Id,
                Prompt = JsonSerializer.Serialize(input, JsonOpts),
                Response = JsonSerializer.Serialize(result, JsonOpts),
                Provider = ai.ProviderName, Model = ai.Model,
            });
            await db.SaveChangesAsync(ct);
            return Result.Failure<AISuggestionDto>(AIErrors.EmptyResult);
        }

        var payload = JsonSerializer.Serialize(new
        {
            sprintId = sprint.Id,
            sprintName = sprint.Name,
            projection = new
            {
                projection.ProjectedDaysBehind,
                projection.ProjectedShortfallPoints,
                projection.RecentAverageVelocity,
                committedPts,
                donePts,
            },
            cutScope = result.CutScope is null ? null : new
            {
                summary = result.CutScope.Summary,
                taskIds = result.CutScope.TaskIds,
                pointsCut = result.CutScope.PointsCut,
                daysSaved = result.CutScope.DaysSaved,
                tasks = cuttable
                    .Where(c => result.CutScope.TaskIds.Contains(c.TaskId))
                    .Select(c => new { c.TaskId, c.Key, c.Title, c.Points }),
            },
            addResource = result.AddResource is null ? null : new
            {
                summary = result.AddResource.Summary,
                memberId = result.AddResource.MemberId,
                memberName = underutilized
                    .FirstOrDefault(m => m.UserId == result.AddResource.MemberId)
                    ?.FullName,
                reassignTaskIds = result.AddResource.ReassignTaskIds,
                tasks = cuttable
                    .Where(c => result.AddResource.ReassignTaskIds.Contains(c.TaskId))
                    .Select(c => new { c.TaskId, c.Key, c.Title, c.Points }),
                daysSaved = result.AddResource.DaysSaved,
            },
            shiftMilestone = result.ShiftMilestone is null ? null : new
            {
                summary = result.ShiftMilestone.Summary,
                milestoneId = result.ShiftMilestone.MilestoneId,
                milestoneTitle = downstreamMilestones
                    .FirstOrDefault(m => m.MilestoneId == result.ShiftMilestone.MilestoneId)
                    ?.Title,
                shiftDays = result.ShiftMilestone.ShiftDays,
            },
        }, JsonOpts);

        var suggestion = new AISuggestion
        {
            ProjectId = project.Id,
            Kind = "sprint.replan",
            Title = string.IsNullOrWhiteSpace(result.Headline)
                ? $"{sprint.Name} projected {projection.ProjectedDaysBehind} days behind"
                : result.Headline,
            Body = $"Committed {committedPts}pts, delivered {donePts}pts. Projected shortfall: {projection.ProjectedShortfallPoints}pts ({projection.ProjectedDaysBehind} days). Pick one option below to act, or dismiss.",
            PayloadJson = payload,
            Status = "Open",
            CreatedByUserId = Guid.Empty,
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AISuggestions.Add(suggestion);

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "sprint.replan",
            ProjectId = project.Id,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Response = JsonSerializer.Serialize(result, JsonOpts),
            Provider = ai.ProviderName, Model = ai.Model,
            Applied = true, AppliedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new AISuggestionDto(
            suggestion.Id, suggestion.ProjectId, project.Type.ToString(),
            suggestion.Kind, suggestion.Title, suggestion.Body,
            suggestion.PayloadJson, suggestion.Status,
            suggestion.CreatedAt, suggestion.ActedAt, suggestion.Provider));
    }
}
