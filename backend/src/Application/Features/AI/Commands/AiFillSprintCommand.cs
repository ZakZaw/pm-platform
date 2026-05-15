using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

public record SprintFillPickDto(Guid StoryId, string Title, int Points, string Reasoning);

public record SprintFillPlanDto(
    int TargetCapacityPoints,
    int SelectedPoints,
    IReadOnlyList<SprintFillPickDto> Picks,
    string Reasoning);

public record AiFillSprintCommand(Guid SprintId, int TargetCapacityPercent)
    : IRequest<Result<SprintFillPlanDto>>;

public class AiFillSprintCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai)
    : IRequestHandler<AiFillSprintCommand, Result<SprintFillPlanDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<SprintFillPlanDto>> Handle(
        AiFillSprintCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<SprintFillPlanDto>(AuthErrors.NotAuthenticated);

        var sprint = await db.Sprints
            .Where(s => s.Id == request.SprintId)
            .Select(s => new { s.Id, s.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (sprint is null)
            return Result.Failure<SprintFillPlanDto>(SprintErrors.NotFound);

        // Capacity model: sum the project members' weekly capacity hours,
        // map to points using a 4 hrs/point heuristic, then apply the target
        // percentage. Phase 1 has no per-sprint capacity field so this is
        // the best proxy.
        var totalHours = await db.ProjectMemberships
            .Where(m => m.ProjectId == sprint.ProjectId)
            .Join(db.Users, m => m.UserId, u => u.Id, (m, u) => u.CapacityHoursPerWeek)
            .SumAsync(ct);
        var capacityPoints = Math.Max(1,
            (int)Math.Round(totalHours / 4.0 * Math.Clamp(request.TargetCapacityPercent, 10, 100) / 100.0));

        var alreadyInSprint = await db.Stories
            .Where(s => s.SprintId == sprint.Id)
            .Select(s => s.Id)
            .ToListAsync(ct);

        var backlogQuery = await db.Stories
            .Where(s => s.ProjectId == sprint.ProjectId
                         && s.SprintId == null
                         && s.Status == DomainTaskStatus.Backlog)
            .OrderBy(s => s.PriorityOrder)
            .Select(s => new
            {
                s.Id,
                s.Title,
                Points = s.StoryPoints ?? 3,
                Priority = s.Priority.ToString(),
            })
            .ToListAsync(ct);

        var titleById = backlogQuery.ToDictionary(b => b.Id, b => b.Title);
        var pointsById = backlogQuery.ToDictionary(b => b.Id, b => b.Points);

        var aiInput = new AI.AISprintFillInput(
            capacityPoints,
            backlogQuery.Select(b => new AI.AISprintFillCandidate(
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
            .Where(p => titleById.ContainsKey(p.StoryId))
            .Select(p => new SprintFillPickDto(
                p.StoryId, titleById[p.StoryId], pointsById[p.StoryId], p.Reasoning))
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
