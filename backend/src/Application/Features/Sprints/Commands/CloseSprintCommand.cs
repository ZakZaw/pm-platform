using Application.Common;
using Application.Features.Sprints.Notifications;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Commands;

public record CloseSprintCommand(Guid SprintId, bool MoveCarryoversToBacklog = true)
    : IRequest<Result<SprintDto>>;

public class CloseSprintCommandHandler(
    IAppDbContext db,
    IProjectEventBus events,
    IPublisher mediatorPublisher)
    : IRequestHandler<CloseSprintCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(CloseSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null)
            return Result.Failure<SprintDto>(SprintErrors.NotFound);
        if (sprint.Status != SprintStatus.Active)
            return Result.Failure<SprintDto>(SprintErrors.NotActive);

        var tasks = await db.Tasks.Where(t => t.SprintId == sprint.Id).ToListAsync(ct);

        var donePts = tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);
        var closedAt = DateTime.UtcNow;

        // L9 - claim the Active -> Closed transition atomically so a double
        // click / two tabs can't close (and carry over, and fire the retro)
        // twice. The loser sees NotActive.
        var claimed = await db.Sprints
            .Where(s => s.Id == sprint.Id && s.Status == SprintStatus.Active)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, SprintStatus.Closed)
                .SetProperty(x => x.ClosedAt, closedAt)
                .SetProperty(x => x.FinalVelocity, donePts), ct);
        if (claimed == 0)
            return Result.Failure<SprintDto>(SprintErrors.NotActive);

        if (request.MoveCarryoversToBacklog)
        {
            // Only unfinished work carries over: Done and WontDo tasks are
            // resolved and stay with the sprint they were resolved in.
            foreach (var t in tasks.Where(t => IsCarryover(t.Status)))
                t.SprintId = null;
        }

        // Mirror the committed values on the tracked entity for the DTO.
        sprint.FinalVelocity = donePts;
        sprint.Status = SprintStatus.Closed;
        sprint.ClosedAt = closedAt;

        await db.SaveChangesAsync(ct);
        await events.PublishAsync(sprint.ProjectId, "sprint.changed",
            new { sprintId = sprint.Id, status = "Closed", finalVelocity = donePts }, ct);

        // F2-11 — fire off the retro generation. The handler short-
        // circuits when AI mode is Off; provider failures are swallowed
        // so the user's close request returns successfully either way.
        try
        {
            await mediatorPublisher.Publish(
                new SprintClosedNotification(sprint.Id, sprint.ProjectId), ct);
        }
        catch { /* retro can be regenerated on demand */ }

        var totalPts = tasks.Sum(t => t.StoryPoints ?? 0);
        return Result.Success(SprintMapper.ToDto(sprint, tasks.Count, totalPts, donePts));
    }

    /// <summary>L9 - tasks that go back to the backlog when a sprint closes.</summary>
    public static bool IsCarryover(DomainTaskStatus status) =>
        status is not (DomainTaskStatus.Done or DomainTaskStatus.WontDo);
}
