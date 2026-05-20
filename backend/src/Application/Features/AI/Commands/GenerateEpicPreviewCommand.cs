using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

/// <summary>
/// Generate ONE epic (with its tasks) for an existing project. Unlike
/// <see cref="GenerateProjectPreviewCommand"/> we don't persist a draft row —
/// the preview is held in the browser until the user confirms via
/// <see cref="ApplyEpicGenerationCommand"/>. The flow is still audited via
/// <see cref="AIAuditLog"/>.
/// </summary>
public record GenerateEpicPreviewCommand(
    Guid ProjectId,
    string Description)
    : IRequest<Result<AIGeneratedEpicDto>>;

public class GenerateEpicPreviewCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai)
    : IRequestHandler<GenerateEpicPreviewCommand, Result<AIGeneratedEpicDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AIGeneratedEpicDto>> Handle(
        GenerateEpicPreviewCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AIGeneratedEpicDto>(AuthErrors.NotAuthenticated);

        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length is < 10 or > 2000)
            return Result.Failure<AIGeneratedEpicDto>(AIErrors.InvalidDescription);

        if (!ai.IsConfigured)
            return Result.Failure<AIGeneratedEpicDto>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name, EnvType = p.EnvironmentType })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<AIGeneratedEpicDto>(ProjectErrors.NotFound);

        var existingTitles = await db.Epics
            .Where(e => e.ProjectId == project.Id && e.ArchivedAt == null)
            .Select(e => e.Title)
            .ToListAsync(ct);

        var input = new AIEpicGenerationInput(
            project.Name,
            project.EnvType.ToString(),
            description,
            existingTitles);

        var audit = new AIAuditLog
        {
            ActionType = "epic.generate",
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
            return Result.Failure<AIGeneratedEpicDto>(AIErrors.ProviderFailed);
        }

        if (generated.Tasks.Count == 0)
        {
            audit.ErrorMessage = "Empty tasks array";
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGeneratedEpicDto>(AIErrors.EmptyResult);
        }

        foreach (var task in generated.Tasks)
        {
            if (task.AcceptanceCriteria.Count is < 2 or > 5)
            {
                audit.ErrorMessage = "AC count out of range for task: " + task.Title;
                await db.SaveChangesAsync(ct);
                return Result.Failure<AIGeneratedEpicDto>(AIErrors.MissingAcceptanceCriteria);
            }
        }

        var dto = new AIGeneratedEpicDto(
            generated.Title,
            generated.Description,
            generated.Color,
            generated.Tasks.Select(t => new AIGeneratedTaskDto(
                t.Title, t.Description, t.StoryPoints, t.Priority, t.AcceptanceCriteria
            )).ToList());

        audit.Response = JsonSerializer.Serialize(dto, JsonOpts);
        await db.SaveChangesAsync(ct);

        return Result.Success(dto);
    }
}
