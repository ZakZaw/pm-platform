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
/// F2-14 — "new feature request -> epic breakdown". Same AI pass as
/// <see cref="GenerateEpicPreviewCommand"/> plus a deterministic
/// timeline-impact projection so the user sees, before committing,
/// which open sprints would overflow and which downstream milestones
/// would shift. The actual write still goes through
/// <see cref="ApplyEpicGenerationCommand"/>; this command never
/// persists the epic.
/// </summary>
public record GenerateEpicBreakdownCommand(
    Guid ProjectId,
    string Description)
    : IRequest<Result<AIEpicBreakdownPreviewDto>>;

public class GenerateEpicBreakdownCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai,
    IAIControlGate aiGate)
    : IRequestHandler<GenerateEpicBreakdownCommand, Result<AIEpicBreakdownPreviewDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private const int RecentVelocitySampleSize = 3;

    public async Task<Result<AIEpicBreakdownPreviewDto>> Handle(
        GenerateEpicBreakdownCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AIEpicBreakdownPreviewDto>(AuthErrors.NotAuthenticated);

        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length is < 10 or > 2000)
            return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.InvalidDescription);

        if (!await aiGate.IsAllowedAsync(request.ProjectId, ct))
            return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.DisabledForProject);

        if (!ai.IsConfigured)
            return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name, ProjType = p.Type })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<AIEpicBreakdownPreviewDto>(ProjectErrors.NotFound);

        var existingTitles = await db.Epics
            .Where(e => e.ProjectId == project.Id && e.ArchivedAt == null)
            .Select(e => e.Title)
            .ToListAsync(ct);

        var input = new AIEpicGenerationInput(
            project.Name,
            project.ProjType.ToString(),
            description,
            existingTitles);

        var audit = new AIAuditLog
        {
            ActionType = "epic.breakdown",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AIAuditLogs.Add(audit);

        AIGeneratedEpic generated;
        try
        {
            generated = await ai.GenerateEpicStructureAsync(input, ct);
        }
        catch (Exception ex)
        {
            audit.ErrorMessage = ex.Message;
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.ProviderFailed);
        }

        if (generated.Tasks.Count == 0)
        {
            audit.ErrorMessage = "Empty tasks array";
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.EmptyResult);
        }

        foreach (var task in generated.Tasks)
        {
            if (task.AcceptanceCriteria.Count is < 2 or > 5)
            {
                audit.ErrorMessage = "AC count out of range for task: " + task.Title;
                await db.SaveChangesAsync(ct);
                return Result.Failure<AIEpicBreakdownPreviewDto>(AIErrors.MissingAcceptanceCriteria);
            }
        }

        var epicDto = new AIGeneratedEpicDto(
            generated.Title,
            generated.Description,
            generated.Color,
            generated.Tasks.Select(t => new AIGeneratedTaskDto(
                t.Title, t.Description, t.StoryPoints, t.Priority, t.AcceptanceCriteria
            )).ToList());

        // --- Timeline impact -----------------------------------------------------

        var addedPoints = generated.Tasks.Sum(t => Math.Max(0, t.StoryPoints));

        var recentVelocities = await db.Sprints
            .Where(s => s.ProjectId == project.Id
                     && s.Status == SprintStatus.Closed
                     && s.FinalVelocity != null)
            .OrderByDescending(s => s.ClosedAt)
            .Take(RecentVelocitySampleSize)
            .Select(s => s.FinalVelocity!.Value)
            .ToListAsync(ct);

        var openSprintsRaw = await db.Sprints
            .Where(s => s.ProjectId == project.Id
                     && (s.Status == SprintStatus.Planning
                       || s.Status == SprintStatus.Active))
            .OrderBy(s => s.StartDate)
            .Select(s => new
            {
                s.Id, s.Name, s.Status, s.StartDate, s.EndDate, s.VelocityTarget,
            })
            .ToListAsync(ct);

        var openSprintIds = openSprintsRaw.Select(s => s.Id).ToList();
        var committedByOpenSprint = await db.Tasks
            .Where(t => t.SprintId != null
                     && openSprintIds.Contains(t.SprintId!.Value))
            .GroupBy(t => t.SprintId!.Value)
            .Select(g => new { SprintId = g.Key, Points = g.Sum(t => t.StoryPoints ?? 0) })
            .ToDictionaryAsync(g => g.SprintId, g => g.Points, ct);

        // Average sprint length: use the most recent open sprint when
        // available, otherwise the projector's fallback kicks in.
        var avgSprintLen = openSprintsRaw.Count > 0
            ? Math.Max(1, (int)(openSprintsRaw[0].EndDate - openSprintsRaw[0].StartDate).TotalDays)
            : 0;

        var milestones = await db.Milestones
            .Where(m => m.ProjectId == project.Id)
            .OrderBy(m => m.Date)
            .Select(m => new { m.Id, m.Title, m.Date })
            .ToListAsync(ct);

        var projection = TimelineImpactProjector.Project(new TimelineImpactInput(
            AddedStoryPoints: addedPoints,
            AverageSprintLengthDays: avgSprintLen,
            RecentClosedVelocities: recentVelocities,
            OpenSprints: openSprintsRaw.Select(s =>
            {
                committedByOpenSprint.TryGetValue(s.Id, out var committed);
                return new OpenSprintSnapshot(
                    SprintId: s.Id,
                    Name: s.Name,
                    Status: s.Status.ToString(),
                    CommittedPoints: committed,
                    VelocityTargetPoints: s.VelocityTarget);
            }).ToList(),
            Milestones: milestones
                .Select(m => new MilestoneSnapshot(m.Id, m.Title, m.Date)).ToList(),
            TodayDate: DateOnly.FromDateTime(DateTime.UtcNow)));

        // Re-key the per-sprint impact back to its (start/end) DTO so
        // the UI can render a sensible sprint label without a second
        // round-trip.
        var sprintMeta = openSprintsRaw.ToDictionary(s => s.Id);
        var sprintImpactDtos = projection.Sprints
            .Select(s =>
            {
                var meta = sprintMeta[s.SprintId];
                return new AISprintImpactDto(
                    SprintId: s.SprintId,
                    Name: s.Name,
                    Status: s.Status,
                    StartDate: meta.StartDate,
                    EndDate: meta.EndDate,
                    CommittedPoints: s.CommittedPoints,
                    TargetPoints: s.TargetPoints,
                    RemainingCapacityPoints: s.RemainingCapacityPoints,
                    ProjectedOverflowPoints: s.ProjectedOverflowPoints,
                    WouldFit: s.WouldFit);
            })
            .ToList();

        var impact = new AITimelineImpactDto(
            AddedStoryPoints: projection.AddedStoryPoints,
            ProjectVelocityPointsPerSprint: projection.ProjectVelocityPointsPerSprint,
            AverageSprintLengthDays: projection.AverageSprintLengthDays,
            HasHistoricalVelocity: projection.HasHistoricalVelocity,
            EstimatedSprintsToComplete: projection.EstimatedSprintsToComplete,
            ProjectedShiftDays: projection.ProjectedShiftDays,
            Sprints: sprintImpactDtos,
            Milestones: projection.Milestones
                .Select(m => new AIMilestoneImpactDto(
                    m.MilestoneId, m.Title, m.Date,
                    m.DaysUntil, m.ProjectedShiftDays))
                .ToList());

        var preview = new AIEpicBreakdownPreviewDto(epicDto, impact);

        audit.Response = JsonSerializer.Serialize(preview, JsonOpts);
        await db.SaveChangesAsync(ct);

        return Result.Success(preview);
    }
}
