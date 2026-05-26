using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

public record SprintFillPickDto(Guid TaskId, string Title, int Points, string Reasoning);

public record SprintFillPlanDto(
    int TargetCapacityPoints,
    int SelectedPoints,
    IReadOnlyList<SprintFillPickDto> Picks,
    string Reasoning);

public record AiFillSprintCommand(Guid SprintId, int TargetCapacityPercent)
    : IRequest<Result<SprintFillPlanDto>>;

public class AiFillSprintCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai, IAIControlGate aiGate)
    : IRequestHandler<AiFillSprintCommand, Result<SprintFillPlanDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<SprintFillPlanDto>> Handle(
        AiFillSprintCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<SprintFillPlanDto>(AuthErrors.NotAuthenticated);

        if (!ai.IsConfigured)
            return Result.Failure<SprintFillPlanDto>(AIErrors.NotConfigured);

        var sprint = await db.Sprints
            .Where(s => s.Id == request.SprintId)
            .Select(s => new { s.Id, s.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (sprint is null)
            return Result.Failure<SprintFillPlanDto>(SprintErrors.NotFound);

        if (!await aiGate.IsAllowedAsync(sprint.ProjectId, ct))
            return Result.Failure<SprintFillPlanDto>(AIErrors.DisabledForProject);

        var totalHours = await db.ProjectMemberships
            .Where(m => m.ProjectId == sprint.ProjectId)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => u.CapacityHoursPerWeek)
            .SumAsync(ct);
        var capacityPoints = Math.Max(1,
            (int)Math.Round(totalHours / 4.0 * Math.Clamp(request.TargetCapacityPercent, 10, 100) / 100.0));

        var alreadyInSprint = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var backlog = await db.Tasks
            .Where(t => t.ProjectId == sprint.ProjectId
                         && t.SprintId == null
                         && t.Status == DomainTaskStatus.Backlog)
            .OrderBy(t => t.PriorityOrder)
            .Select(t => new
            {
                t.Id,
                t.Title,
                Points = t.StoryPoints ?? 3,
                Priority = t.Priority.ToString(),
            })
            .ToListAsync(ct);

        var titleById = backlog.ToDictionary(b => b.Id, b => b.Title);
        var pointsById = backlog.ToDictionary(b => b.Id, b => b.Points);

        var aiInput = new AI.AISprintFillInput(
            capacityPoints,
            backlog.Select(b => new AI.AISprintFillCandidate(
                b.Id, b.Title, b.Points, b.Priority, [])).ToList(),
            alreadyInSprint);

        AI.AISprintFillPlan plan;
        try
        {
            plan = await ai.SuggestSprintFillAsync(aiInput, ct);
        }
        catch
        {
            return Result.Failure<SprintFillPlanDto>(AIErrors.ProviderFailed);
        }

        var pickDtos = plan.Picks
            .Where(p => titleById.ContainsKey(p.TaskId))
            .Select(p => new SprintFillPickDto(
                p.TaskId, titleById[p.TaskId], pointsById[p.TaskId], p.Reasoning))
            .ToList();

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "sprint.aifill",
            UserId = userId,
            ProjectId = sprint.ProjectId,
            Prompt = JsonSerializer.Serialize(aiInput, JsonOpts),
            Response = JsonSerializer.Serialize(plan, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
            Applied = false,
        });
        await db.SaveChangesAsync(ct);

        return Result.Success(new SprintFillPlanDto(
            plan.TargetCapacityPoints,
            plan.SelectedPoints,
            pickDtos,
            plan.Reasoning));
    }
}
