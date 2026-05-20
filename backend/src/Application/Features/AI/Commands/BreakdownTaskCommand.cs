using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

/// <summary>
/// Generate a refined description, acceptance-criteria list, and optional
/// updated points estimate for an existing task. Read-only — the caller
/// applies the result via the regular Task update endpoint after the user
/// confirms.
/// </summary>
public record BreakdownTaskCommand(Guid TaskId)
    : IRequest<Result<TaskBreakdownDto>>;

public record TaskBreakdownDto(
    string RefinedDescription,
    IReadOnlyList<string> AcceptanceCriteria,
    int? SuggestedStoryPoints,
    string Reasoning);

public class BreakdownTaskCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai)
    : IRequestHandler<BreakdownTaskCommand, Result<TaskBreakdownDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<TaskBreakdownDto>> Handle(
        BreakdownTaskCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TaskBreakdownDto>(AuthErrors.NotAuthenticated);

        if (!ai.IsConfigured)
            return Result.Failure<TaskBreakdownDto>(AIErrors.NotConfigured);

        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new
            {
                t.Id, t.Title, t.Description, t.AcceptanceCriteria,
                t.ProjectId, t.StoryPoints,
            })
            .FirstOrDefaultAsync(ct);
        if (task is null)
            return Result.Failure<TaskBreakdownDto>(TaskErrors.NotFound);

        var input = new AITaskBreakdownInput(
            task.Title,
            task.Description,
            task.AcceptanceCriteria ?? Array.Empty<string>(),
            task.StoryPoints);

        var audit = new AIAuditLog
        {
            ActionType = "task.breakdown",
            UserId = userId,
            ProjectId = task.ProjectId,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AIAuditLogs.Add(audit);

        AITaskBreakdown result;
        try
        {
            result = await ai.BreakdownTaskAsync(input, ct);
        }
        catch (Exception ex)
        {
            audit.ErrorMessage = ex.Message;
            await db.SaveChangesAsync(ct);
            return Result.Failure<TaskBreakdownDto>(AIErrors.ProviderFailed);
        }

        if (result.AcceptanceCriteria.Count == 0)
        {
            audit.ErrorMessage = "Empty acceptanceCriteria";
            await db.SaveChangesAsync(ct);
            return Result.Failure<TaskBreakdownDto>(AIErrors.EmptyResult);
        }

        audit.Response = JsonSerializer.Serialize(result, JsonOpts);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TaskBreakdownDto(
            result.RefinedDescription,
            result.AcceptanceCriteria,
            result.SuggestedStoryPoints,
            result.Reasoning));
    }
}
