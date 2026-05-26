using System.Text.Json;
using Application.Common;
using Application.Features.AI;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Retrospective;

/// <summary>
/// Generate (or regenerate) the retro for a closed sprint. The sprint
/// must be in Closed state; AI control mode gates the call. If a retro
/// row already exists for the sprint it is overwritten — the audit
/// trail lives in <see cref="AIAuditLog"/>, not in versioned rows.
/// </summary>
public record GenerateSprintRetrospectiveCommand(Guid SprintId)
    : IRequest<Result<SprintRetrospectiveDto>>;

public class GenerateSprintRetrospectiveCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IAIService ai,
    IAIControlGate aiGate)
    : IRequestHandler<GenerateSprintRetrospectiveCommand, Result<SprintRetrospectiveDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<SprintRetrospectiveDto>> Handle(
        GenerateSprintRetrospectiveCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<SprintRetrospectiveDto>(AuthErrors.NotAuthenticated);

        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null) return Result.Failure<SprintRetrospectiveDto>(SprintErrors.NotFound);
        if (sprint.Status != SprintStatus.Closed)
            return Result.Failure<SprintRetrospectiveDto>(SprintErrors.NotClosed);

        if (!await aiGate.IsAllowedAsync(sprint.ProjectId, ct))
            return Result.Failure<SprintRetrospectiveDto>(AIErrors.DisabledForProject);

        if (!ai.IsConfigured)
            return Result.Failure<SprintRetrospectiveDto>(AIErrors.NotConfigured);

        // Build the AI input from sprint state. Tasks were already
        // detached from the sprint on close, so use the status-history
        // table plus FinalVelocity for committed/delivered counts. For
        // simplicity we use the snapshot the close already wrote.
        var project = await db.Projects
            .Where(p => p.Id == sprint.ProjectId)
            .Select(p => new { p.Id, p.Name, p.Key })
            .FirstAsync(ct);

        // Tasks closed within the sprint window are the "delivered"
        // count; anything that carried over is in the backlog. The close
        // command moves carryovers off the sprint, so re-fetching by
        // SprintId picks up only what stayed (= what was done).
        var sprintTasks = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .Select(t => new
            {
                t.Id, t.Title, t.Status, t.StoryPoints, t.KeyNum,
            })
            .ToListAsync(ct);
        var deliveredPts = sprintTasks
            .Where(t => t.Status == DomainTaskStatus.Done)
            .Sum(t => t.StoryPoints ?? 0);
        // Use FinalVelocity for delivered (canonical) and the scope
        // baseline JSON if present for committed; fall back to summing
        // current sprint-task points.
        var deliveredFromClose = sprint.FinalVelocity ?? deliveredPts;
        var committedPts = ParseCommittedFromBaseline(sprint.ScopeBaselineJson)
            ?? sprintTasks.Sum(t => t.StoryPoints ?? 0) + deliveredFromClose;
        var carryovers = Math.Max(0, committedPts - deliveredFromClose);

        var blockers = await db.TaskStatusChanges
            .Where(c => c.ToStatus == DomainTaskStatus.Blocked
                     && c.Task.ProjectId == sprint.ProjectId
                     && c.CreatedAt >= sprint.StartDate
                     && c.CreatedAt <= (sprint.ClosedAt ?? DateTime.UtcNow))
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new { c.Task.Title, c.Reason })
            .Take(8)
            .ToListAsync(ct);
        var blockerTitles = blockers
            .Select(b => string.IsNullOrWhiteSpace(b.Reason)
                ? b.Title
                : $"{b.Title} — {b.Reason}")
            .ToList();

        var recent = await db.Sprints
            .Where(s => s.ProjectId == sprint.ProjectId
                     && s.Id != sprint.Id
                     && s.FinalVelocity != null)
            .OrderByDescending(s => s.ClosedAt)
            .Take(6)
            .Select(s => new { s.Name, s.FinalVelocity, s.ScopeBaselineJson })
            .ToListAsync(ct);
        var history = recent.Select(r =>
        {
            var c = ParseCommittedFromBaseline(r.ScopeBaselineJson) ?? r.FinalVelocity ?? 0;
            return new AIRetroSprintHistory(r.Name, c, r.FinalVelocity ?? 0);
        }).ToList();

        // Highest-priority backlog candidates the AI may pick from.
        var backlog = await db.Tasks
            .Where(t => t.ProjectId == sprint.ProjectId
                     && t.SprintId == null
                     && t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo)
            .OrderBy(t => t.PriorityOrder)
            .ThenBy(t => t.KeyNum)
            .Take(30)
            .Select(t => new
            {
                t.Id, t.Title, t.StoryPoints, t.Priority, t.KeyNum,
            })
            .ToListAsync(ct);
        var candidates = backlog.Select(b => new AIRetroBacklogCandidate(
            b.Id,
            $"{project.Key}-{b.KeyNum}",
            b.Title,
            b.StoryPoints ?? 0,
            b.Priority.ToString())).ToList();

        var input = new AISprintRetroInput(
            ProjectName: project.Name,
            SprintName: sprint.Name,
            Goal: null,
            CommittedPoints: committedPts,
            DeliveredPoints: deliveredFromClose,
            Carryovers: carryovers,
            Blockers: blockerTitles,
            RecentSprints: history,
            Backlog: candidates);

        AISprintRetrospective retro;
        try
        {
            retro = await ai.GenerateSprintRetrospectiveAsync(input, ct);
        }
        catch (Exception ex)
        {
            db.AIAuditLogs.Add(new AIAuditLog
            {
                ActionType = "sprint.retro.failed",
                UserId = userId, ProjectId = project.Id,
                Prompt = JsonSerializer.Serialize(input, JsonOpts),
                ErrorMessage = ex.Message,
                Provider = ai.ProviderName, Model = ai.Model,
            });
            await db.SaveChangesAsync(ct);
            return Result.Failure<SprintRetrospectiveDto>(AIErrors.ProviderFailed);
        }

        if (string.IsNullOrWhiteSpace(retro.Summary))
            return Result.Failure<SprintRetrospectiveDto>(AIErrors.EmptyResult);

        // Upsert — regenerate replaces the in-place row, including the
        // applied stamps if the PM regenerates before applying.
        var existing = await db.SprintRetrospectives
            .FirstOrDefaultAsync(r => r.SprintId == sprint.Id, ct);
        if (existing is null)
        {
            existing = new SprintRetrospective
            {
                SprintId = sprint.Id,
                Summary = retro.Summary,
                WhatWentWell = retro.WhatWentWell,
                WhatDidnt = retro.WhatDidnt,
                Suggestions = retro.Suggestions,
                NextSprintDraftJson = retro.NextSprintDraft is null
                    ? null
                    : JsonSerializer.Serialize(retro.NextSprintDraft, JsonOpts),
                GeneratedByUserId = userId,
                Provider = ai.ProviderName,
                Model = ai.Model,
            };
            db.SprintRetrospectives.Add(existing);
        }
        else
        {
            existing.Summary = retro.Summary;
            existing.WhatWentWell = retro.WhatWentWell;
            existing.WhatDidnt = retro.WhatDidnt;
            existing.Suggestions = retro.Suggestions;
            existing.NextSprintDraftJson = retro.NextSprintDraft is null
                ? null
                : JsonSerializer.Serialize(retro.NextSprintDraft, JsonOpts);
            existing.GeneratedByUserId = userId;
            existing.GeneratedAt = DateTime.UtcNow;
            existing.AppliedByUserId = null;
            existing.AppliedAt = null;
            existing.AppliedSprintId = null;
            existing.Provider = ai.ProviderName;
            existing.Model = ai.Model;
        }

        db.AIAuditLogs.Add(new AIAuditLog
        {
            ActionType = "sprint.retro",
            UserId = userId, ProjectId = project.Id,
            Prompt = JsonSerializer.Serialize(input, JsonOpts),
            Response = JsonSerializer.Serialize(retro, JsonOpts),
            Provider = ai.ProviderName, Model = ai.Model,
            Applied = true, AppliedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        return Result.Success(RetrospectiveMapper.ToDto(existing, retro.NextSprintDraft, candidates));
    }

    // Scope baseline is a JSON snapshot of tasks at sprint start; pull
    // the committed-point total when it's there. Older sprints may not
    // have one — return null so callers fall back.
    internal static int? ParseCommittedFromBaseline(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("committedPoints", out var cp)
                && cp.TryGetInt32(out var cpv)) return cpv;
            if (doc.RootElement.TryGetProperty("totalPoints", out var tp)
                && tp.TryGetInt32(out var tpv)) return tpv;
        }
        catch (JsonException) { /* fall through to null */ }
        return null;
    }
}
