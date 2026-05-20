using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.AI.Commands;

/// <summary>
/// Diagnose the project's currently active sprint and persist the result as
/// an open <see cref="AISuggestion"/>. The user opens the AI Inbox to act
/// on it (accept / dismiss). Falls back to AI.EmptyResult when no Active
/// sprint exists.
/// </summary>
public record GenerateSprintHealthInsightCommand(Guid ProjectId)
    : IRequest<Result<AISuggestionDto>>;

public class GenerateSprintHealthInsightCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IAIService ai)
    : IRequestHandler<GenerateSprintHealthInsightCommand, Result<AISuggestionDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<AISuggestionDto>> Handle(
        GenerateSprintHealthInsightCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<AISuggestionDto>(AuthErrors.NotAuthenticated);

        if (!ai.IsConfigured)
            return Result.Failure<AISuggestionDto>(AIErrors.NotConfigured);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.Name })
            .FirstOrDefaultAsync(ct);
        if (project is null)
            return Result.Failure<AISuggestionDto>(ProjectErrors.NotFound);

        var sprint = await db.Sprints
            .Where(s => s.ProjectId == project.Id && s.Status == Domain.Enums.SprintStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefaultAsync(ct);
        if (sprint is null)
            return Result.Failure<AISuggestionDto>(AIErrors.EmptyResult);

        var sprintLen = Math.Max(1, (sprint.EndDate - sprint.StartDate).Days);
        var elapsed = Math.Clamp((int)(DateTime.UtcNow - sprint.StartDate).TotalDays, 0, sprintLen);

        var stats = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .GroupBy(t => t.Status)
            .Select(g => new { Status = g.Key, Points = g.Sum(t => t.StoryPoints ?? 0) })
            .ToListAsync(ct);

        int Pts(DomainTaskStatus s) => stats.FirstOrDefault(x => x.Status == s)?.Points ?? 0;
        var committed = stats.Sum(s => s.Points);
        var done = Pts(DomainTaskStatus.Done);
        var inProgress = Pts(DomainTaskStatus.InProgress);
        var blocked = Pts(DomainTaskStatus.Blocked);

        var blockedTitles = await db.Tasks
            .Where(t => t.SprintId == sprint.Id && t.Status == DomainTaskStatus.Blocked)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => t.Title)
            .Take(5)
            .ToListAsync(ct);

        var recentVels = await db.Sprints
            .Where(s => s.ProjectId == project.Id
                        && s.Id != sprint.Id
                        && s.FinalVelocity != null)
            .OrderByDescending(s => s.ClosedAt)
            .Take(6)
            .Select(s => s.FinalVelocity!.Value)
            .ToListAsync(ct);

        var input = new AISprintHealthInput(
            project.Name, sprint.Name,
            elapsed, sprintLen,
            committed, done, inProgress, blocked,
            sprint.VelocityTarget,
            blockedTitles, recentVels);

        AISprintHealthInsight insight;
        try
        {
            insight = await ai.GenerateSprintHealthInsightAsync(input, ct);
        }
        catch (Exception ex)
        {
            db.AIAuditLogs.Add(new AIAuditLog
            {
                ActionType = "suggestion.sprint.health.failed",
                UserId = userId, ProjectId = project.Id,
                Prompt = JsonSerializer.Serialize(input, JsonOpts),
                ErrorMessage = ex.Message,
                Provider = ai.ProviderName, Model = ai.Model,
            });
            await db.SaveChangesAsync(ct);
            return Result.Failure<AISuggestionDto>(AIErrors.ProviderFailed);
        }

        if (string.IsNullOrWhiteSpace(insight.Title))
            return Result.Failure<AISuggestionDto>(AIErrors.EmptyResult);

        var payload = JsonSerializer.Serialize(new
        {
            sprintId = sprint.Id,
            options = insight.Options,
            confidence = insight.Confidence,
        }, JsonOpts);

        var suggestion = new AISuggestion
        {
            ProjectId = project.Id,
            Kind = "sprint.health",
            Title = insight.Title,
            Body = insight.Body,
            PayloadJson = payload,
            Status = "Open",
            CreatedByUserId = userId,
            Provider = ai.ProviderName,
            Model = ai.Model,
        };
        db.AISuggestions.Add(suggestion);

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "suggestion.sprint.health",
            UserId = userId, ProjectId = project.Id,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Response = JsonSerializer.Serialize(insight, JsonOpts),
            Provider = ai.ProviderName, Model = ai.Model,
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(new AISuggestionDto(
            suggestion.Id, suggestion.ProjectId, suggestion.Kind,
            suggestion.Title, suggestion.Body, suggestion.PayloadJson,
            suggestion.Status, suggestion.CreatedAt, suggestion.ActedAt,
            suggestion.Provider));
    }
}
