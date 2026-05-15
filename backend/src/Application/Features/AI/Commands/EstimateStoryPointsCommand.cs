using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

public record StoryEstimateDto(int Points, double Confidence, string Reasoning);

public record EstimateStoryPointsCommand(Guid StoryId)
    : IRequest<Result<StoryEstimateDto>>;

public class EstimateStoryPointsCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai)
    : IRequestHandler<EstimateStoryPointsCommand, Result<StoryEstimateDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<StoryEstimateDto>> Handle(
        EstimateStoryPointsCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<StoryEstimateDto>(AuthErrors.NotAuthenticated);

        var story = await db.Stories
            .Where(s => s.Id == request.StoryId)
            .Select(s => new
            {
                s.Id, s.Title, s.Description, s.AcceptanceCriteria,
                s.ProjectId,
                Project = s.Project,
            })
            .FirstOrDefaultAsync(ct);
        if (story is null)
            return Result.Failure<StoryEstimateDto>(StoryErrors.NotFound);

        // Pull a small sample of similar completed stories in the same org
        // (any project) — title + final point count — to anchor the estimate.
        var orgId = await db.Projects
            .Where(p => p.Id == story.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

        var history = await db.Stories
            .Where(s => s.Id != story.Id
                         && s.Project.OrganizationId == orgId
                         && s.StoryPoints != null
                         && s.Status == DomainTaskStatus.Done)
            .OrderByDescending(s => s.CreatedAt)
            .Take(20)
            .Select(s => new AI.AIEstimationSample(s.Title, s.StoryPoints!.Value))
            .ToListAsync(ct);

        var input = new AI.AIEstimationInput(
            story.Title,
            story.Description,
            story.AcceptanceCriteria ?? Array.Empty<string>(),
            history);

        AI.AIEffortEstimate result;
        try
        {
            result = await ai.EstimateStoryPointsAsync(input, ct);
        }
        catch
        {
            return Result.Failure<StoryEstimateDto>(AIErrors.ProviderFailed);
        }

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "story.estimate",
            UserId = userId,
            ProjectId = story.ProjectId,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Response = JsonSerializer.Serialize(result, JsonOpts),
            Provider = ai.ProviderName,
            Model = ai.Model,
            // This is read-only: it returns a suggestion, the user decides
            // whether to accept by editing the story.
            Applied = false,
        });
        await db.SaveChangesAsync(ct);

        return Result.Success(new StoryEstimateDto(
            result.Points, result.Confidence, result.Reasoning));
    }
}
