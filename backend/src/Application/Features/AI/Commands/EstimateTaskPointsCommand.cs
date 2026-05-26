using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

public record TaskEstimateDto(int Points, double Confidence, string Reasoning);

public record EstimateTaskPointsCommand(Guid TaskId)
    : IRequest<Result<TaskEstimateDto>>;

public class EstimateTaskPointsCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai, IAIControlGate aiGate)
    : IRequestHandler<EstimateTaskPointsCommand, Result<TaskEstimateDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<TaskEstimateDto>> Handle(
        EstimateTaskPointsCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TaskEstimateDto>(AuthErrors.NotAuthenticated);

        if (!ai.IsConfigured)
            return Result.Failure<TaskEstimateDto>(AIErrors.NotConfigured);

        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new
            {
                t.Id, t.Title, t.Description, t.AcceptanceCriteria,
                t.ProjectId,
            })
            .FirstOrDefaultAsync(ct);
        if (task is null)
            return Result.Failure<TaskEstimateDto>(TaskErrors.NotFound);

        if (!await aiGate.IsAllowedAsync(task.ProjectId, ct))
            return Result.Failure<TaskEstimateDto>(AIErrors.DisabledForProject);

        var orgId = await db.Projects
            .Where(p => p.Id == task.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

        var history = await db.Tasks
            .Where(t => t.Id != task.Id
                         && t.Project.OrganizationId == orgId
                         && t.StoryPoints != null
                         && t.Status == DomainTaskStatus.Done)
            .OrderByDescending(t => t.CreatedAt)
            .Take(20)
            .Select(t => new AI.AIEstimationSample(t.Title, t.StoryPoints!.Value))
            .ToListAsync(ct);

        var input = new AI.AIEstimationInput(
            task.Title,
            task.Description,
            task.AcceptanceCriteria ?? Array.Empty<string>(),
            history);

        AI.AIEffortEstimate result;
        try
        {
            result = await ai.EstimateStoryPointsAsync(input, ct);
        }
        catch
        {
            return Result.Failure<TaskEstimateDto>(AIErrors.ProviderFailed);
        }

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "task.estimate",
            UserId = userId,
            ProjectId = task.ProjectId,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Response = JsonSerializer.Serialize(result, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
            Applied = false,
        });
        await db.SaveChangesAsync(ct);

        return Result.Success(new TaskEstimateDto(
            result.Points, result.Confidence, result.Reasoning));
    }
}
