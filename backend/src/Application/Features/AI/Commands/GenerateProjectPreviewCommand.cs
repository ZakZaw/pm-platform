using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.AI.Commands;

public record GenerateProjectPreviewCommand(
    string OrgSlug,
    string Description,
    string Type,
    IReadOnlyList<AIClarificationAnswerDto>? Clarifications)
    : IRequest<Result<AIGenerationPreviewDto>>;

public class GenerateProjectPreviewCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai)
    : IRequestHandler<GenerateProjectPreviewCommand, Result<AIGenerationPreviewDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AIGenerationPreviewDto>> Handle(
        GenerateProjectPreviewCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AIGenerationPreviewDto>(AuthErrors.NotAuthenticated);

        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length is < 10 or > 2000)
            return Result.Failure<AIGenerationPreviewDto>(AIErrors.InvalidDescription);

        if (!ai.IsConfigured)
            return Result.Failure<AIGenerationPreviewDto>(AIErrors.NotConfigured);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<AIGenerationPreviewDto>(OrgErrors.NotFound);

        var clarificationInputs = (request.Clarifications ?? [])
            .Where(c => !string.IsNullOrWhiteSpace(c.Answer))
            .Select(c => new AIClarificationAnswer(c.Question, c.Answer))
            .ToList();

        Domain.Entities.AIAuditLog audit = new()
        {
            ActionType = "project.generate",
            UserId = userId,
            Prompt = JsonSerializer.Serialize(new
            {
                description,
                type = request.Type,
                clarifications = clarificationInputs,
            }, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AIAuditLogs.Add(audit);

        Application.Features.AI.AIGeneratedProject generated;
        try
        {
            generated = await ai.GenerateProjectStructureAsync(
                description, request.Type, clarificationInputs, ct);
        }
        catch (Exception ex)
        {
            audit.ErrorMessage = ex.Message;
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGenerationPreviewDto>(AIErrors.ProviderFailed);
        }

        if (generated.Epics.Count == 0)
        {
            audit.ErrorMessage = "Empty epics array";
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGenerationPreviewDto>(AIErrors.EmptyResult);
        }

        // Each generated task must carry 2-5 acceptance criteria (F1-21 rule
        // re-homed onto tasks now that Stories are gone).
        foreach (var epic in generated.Epics)
        {
            foreach (var task in epic.Tasks)
            {
                if (task.AcceptanceCriteria.Count is < 2 or > 5)
                {
                    audit.ErrorMessage = "AC count out of range for task: " + task.Title;
                    await db.SaveChangesAsync(ct);
                    return Result.Failure<AIGenerationPreviewDto>(AIErrors.MissingAcceptanceCriteria);
                }
            }
        }

        var previewDto = ToPreviewDto(generated, request.Type);

        var requestRow = new AIGenerationRequest
        {
            OrganizationId = org.Id,
            CreatedBy = userId,
            Description = description,
            Type = request.Type,
            ClarificationsJson = JsonSerializer.Serialize(clarificationInputs, JsonOpts),
            PreviewJson = JsonSerializer.Serialize(previewDto, JsonOpts),
            Status = "Draft",
        };
        db.AIGenerationRequests.Add(requestRow);
        audit.Response = requestRow.PreviewJson;
        await db.SaveChangesAsync(ct);

        return Result.Success(new AIGenerationPreviewDto(
            requestRow.Id,
            ai.ProviderName,
            ai.Model,
            generated.SuggestedName,
            request.Type,
            previewDto.Epics));
    }

    internal static AIGenerationPreviewDto ToPreviewDto(
        AIGeneratedProject project, string projectType)
    {
        var epics = project.Epics.Select(e => new AIGeneratedEpicDto(
            e.Title,
            e.Description,
            e.Color,
            e.Tasks.Select(t => new AIGeneratedTaskDto(
                t.Title, t.Description, t.StoryPoints, t.Priority, t.AcceptanceCriteria
            )).ToList()
        )).ToList();
        return new AIGenerationPreviewDto(
            Guid.Empty, "", "", project.SuggestedName, projectType, epics);
    }
}
