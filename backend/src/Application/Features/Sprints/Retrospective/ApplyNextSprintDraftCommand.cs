using Application.Common;
using Application.Features.Sprints;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Retrospective;

/// <summary>
/// Materialise the AI's next-sprint draft as a real Planning sprint.
/// Picks that no longer point at a backlog task (deleted, already in
/// another sprint, completed) are silently skipped. The retro row gets
/// stamped with the new sprint id so a second click is a no-op.
/// </summary>
public record ApplyNextSprintDraftCommand(Guid SprintId)
    : IRequest<Result<SprintDto>>;

public class ApplyNextSprintDraftCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ApplyNextSprintDraftCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(
        ApplyNextSprintDraftCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<SprintDto>(AuthErrors.NotAuthenticated);

        var sprint = await db.Sprints
            .FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null) return Result.Failure<SprintDto>(SprintErrors.NotFound);

        var retro = await db.SprintRetrospectives
            .FirstOrDefaultAsync(r => r.SprintId == sprint.Id, ct);
        if (retro is null) return Result.Failure<SprintDto>(SprintErrors.RetroNotFound);
        if (retro.AppliedAt is not null)
            return Result.Failure<SprintDto>(SprintErrors.RetroAlreadyApplied);

        var draft = RetrospectiveMapper.ParseDraft(retro);
        if (draft is null) return Result.Failure<SprintDto>(AIErrors.EmptyResult);

        // Sprint length mirrors the closed one — keeps cadence stable.
        var length = Math.Max(7, (sprint.EndDate - sprint.StartDate).Days);
        var startDate = DateTime.UtcNow.Date.AddDays(1);
        var endDate = startDate.AddDays(length);

        var newSprint = new Sprint
        {
            ProjectId = sprint.ProjectId,
            Name = string.IsNullOrWhiteSpace(draft.Name) ? "Next sprint" : draft.Name,
            StartDate = startDate,
            EndDate = endDate,
            Status = SprintStatus.Planning,
        };
        db.Sprints.Add(newSprint);

        // Attach the picked tasks. We only attach tasks that are still
        // in the same project, not on another sprint, and not done.
        var ids = draft.Tasks.Select(p => p.TaskId).Distinct().ToList();
        var eligible = await db.Tasks
            .Where(t => ids.Contains(t.Id)
                     && t.ProjectId == sprint.ProjectId
                     && t.SprintId == null
                     && t.Status != DomainTaskStatus.Done
                     && t.Status != DomainTaskStatus.WontDo)
            .ToListAsync(ct);
        foreach (var t in eligible) t.SprintId = newSprint.Id;

        retro.AppliedByUserId = userId;
        retro.AppliedAt = DateTime.UtcNow;
        retro.AppliedSprintId = newSprint.Id;

        await db.SaveChangesAsync(ct);

        var totalPts = eligible.Sum(t => t.StoryPoints ?? 0);
        return Result.Success(SprintMapper.ToDto(newSprint, eligible.Count, totalPts, 0));
    }
}
