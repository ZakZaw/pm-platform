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

        // F1.5-07 — Engineering keeps the original epics+tasks path; all
        // other types take the typed-draft branch. The unified preview DTO
        // carries whichever shape was produced so the wizard can pick a
        // renderer client-side.
        var isEngineering = string.Equals(request.Type, "Engineering", StringComparison.OrdinalIgnoreCase);

        AIGenerationPreviewDto previewDto;
        string suggestedName;
        try
        {
            if (isEngineering)
            {
                var generated = await ai.GenerateProjectStructureAsync(
                    description, request.Type, clarificationInputs, ct);
                if (generated.Epics.Count == 0)
                {
                    audit.ErrorMessage = "Empty epics array";
                    await db.SaveChangesAsync(ct);
                    return Result.Failure<AIGenerationPreviewDto>(AIErrors.EmptyResult);
                }
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
                previewDto = ToEngineeringPreviewDto(generated, request.Type);
                suggestedName = generated.SuggestedName;
            }
            else
            {
                var draft = await ai.GenerateTypedProjectDraftAsync(
                    description, request.Type, clarificationInputs, ct);
                var (preview, name, isEmpty) = ToTypedPreviewDto(draft, request.Type);
                if (isEmpty)
                {
                    audit.ErrorMessage = "AI typed draft contained no entities.";
                    await db.SaveChangesAsync(ct);
                    return Result.Failure<AIGenerationPreviewDto>(AIErrors.EmptyResult);
                }
                previewDto = preview;
                suggestedName = name;
            }
        }
        catch (Exception ex)
        {
            audit.ErrorMessage = ex.Message;
            await db.SaveChangesAsync(ct);
            return Result.Failure<AIGenerationPreviewDto>(AIErrors.ProviderFailed);
        }

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

        return Result.Success(previewDto with
        {
            RequestId = requestRow.Id,
            Provider = ai.ProviderName,
            Model = ai.Model,
            SuggestedName = suggestedName,
        });
    }

    internal static AIGenerationPreviewDto ToEngineeringPreviewDto(
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

    private static (AIGenerationPreviewDto Preview, string Name, bool IsEmpty) ToTypedPreviewDto(
        AITypedProjectDraft draft, string projectType)
    {
        return draft switch
        {
            AISalesProjectDraft s => (
                new AIGenerationPreviewDto(
                    Guid.Empty, "", "", s.SuggestedName, projectType, null, Sales: s),
                s.SuggestedName,
                s.Stages.Count == 0 && s.Accounts.Count == 0 && s.Deals.Count == 0),
            AISupportProjectDraft s => (
                new AIGenerationPreviewDto(
                    Guid.Empty, "", "", s.SuggestedName, projectType, null, Support: s),
                s.SuggestedName,
                s.Queues.Count == 0 && s.Tickets.Count == 0),
            AIMarketingProjectDraft m => (
                new AIGenerationPreviewDto(
                    Guid.Empty, "", "", m.SuggestedName, projectType, null, Marketing: m),
                m.SuggestedName,
                m.Campaigns.Count == 0),
            AIOperationsProjectDraft o => (
                new AIGenerationPreviewDto(
                    Guid.Empty, "", "", o.SuggestedName, projectType, null, Operations: o),
                o.SuggestedName,
                o.Workflows.Count == 0),
            AIGenericProjectDraft g => (
                new AIGenerationPreviewDto(
                    Guid.Empty, "", "", g.SuggestedName, projectType, null, Generic: g),
                g.SuggestedName,
                g.Lists.Count == 0),
            _ => throw new InvalidOperationException(
                $"Unknown typed-project draft variant: {draft.GetType().Name}"),
        };
    }
}
