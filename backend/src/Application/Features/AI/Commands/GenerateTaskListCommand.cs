using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

/// <summary>
/// Generate a list of tasks from a free-form description, scoped to a
/// project and optionally an existing epic. Like the epic-generation flow,
/// nothing is persisted as a draft — the client holds the preview until
/// the user confirms via <see cref="ApplyTaskListCommand"/>.
/// </summary>
public record GenerateTaskListCommand(
    Guid ProjectId,
    Guid? EpicId,
    string Description,
    int? MaxTasks)
    : IRequest<Result<AIGeneratedTaskListDto>>;

public record AIGeneratedTaskListDto(
    Guid ProjectId,
    Guid? EpicId,
    string? EpicTitle,
    IReadOnlyList<AIGeneratedTaskDto> Tasks);

public class GenerateTaskListCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai,
    IAIControlGate aiGate)
    : IRequestHandler<GenerateTaskListCommand, Result<AIGeneratedTaskListDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AIGeneratedTaskListDto>> Handle(
        GenerateTaskListCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AIGeneratedTaskListDto>(AuthErrors.NotAuthenticated);

        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length is < 10 or > 2000)
            return Result.Failure<AIGeneratedTaskListDto>(AIErrors.InvalidDescription);

        if (!await aiGate.IsAllowedAsync(request.ProjectId, ct))
            return Result.Failure<AIGeneratedTaskListDto>(AIErrors.DisabledForProject);

        if (!ai.IsConfigured)
            return Result.Failure<AIGeneratedTaskListDto>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name, p.Type })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<AIGeneratedTaskListDto>(ProjectErrors.NotFound);

        string? epicTitle = null;
        if (request.EpicId is { } epicId)
        {
            var epic = await db.Epics
                .Where(e => e.Id == epicId && e.ProjectId == project.Id)
                .Select(e => new { e.Title })
                .FirstOrDefaultAsync(ct);
            if (epic is null)
                return Result.Failure<AIGeneratedTaskListDto>(TaskErrors.EpicNotInProject);
            epicTitle = epic.Title;
        }

        var input = new AITaskListGenerationInput(
            project.Name,
            project.Type.ToString(),
            description,
            epicTitle,
            request.MaxTasks);

        var audit = new AIAuditLog
        {
            ActionType = "task-list.generate",
            UserId = userId,
            ProjectId = project.Id,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AIAuditLogs.Add(audit);

        IReadOnlyList<AIGeneratedTask> generated;
        try
        {
            generated = await ai.GenerateTaskListAsync(input, ct);
        }
        catch (Exception ex)
        {
            audit.ErrorMessage = ex.Message;
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGeneratedTaskListDto>(AIErrors.ProviderFailed);
        }

        if (generated.Count == 0)
        {
            audit.ErrorMessage = "Empty tasks array";
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGeneratedTaskListDto>(AIErrors.EmptyResult);
        }

        foreach (var task in generated)
        {
            if (task.AcceptanceCriteria.Count is < 2 or > 5)
            {
                audit.ErrorMessage = "AC count out of range for task: " + task.Title;
                await db.SaveChangesAsync(ct);
                return Result.Failure<AIGeneratedTaskListDto>(AIErrors.MissingAcceptanceCriteria);
            }
        }

        var tasks = generated.Select(t => new AIGeneratedTaskDto(
            t.Title, t.Description, t.StoryPoints, t.Priority, t.AcceptanceCriteria
        )).ToList();

        var dto = new AIGeneratedTaskListDto(project.Id, request.EpicId, epicTitle, tasks);

        audit.Response = JsonSerializer.Serialize(dto, JsonOpts);
        await db.SaveChangesAsync(ct);

        return Result.Success(dto);
    }
}
