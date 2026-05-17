using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Commands;

public record StartSprintCommand(Guid SprintId) : IRequest<Result<SprintDto>>;

public class StartSprintCommandHandler(IAppDbContext db, IProjectEventBus events)
    : IRequestHandler<StartSprintCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(StartSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null)
            return Result.Failure<SprintDto>(SprintErrors.NotFound);

        if (sprint.Status != SprintStatus.Planning)
            return Result.Failure<SprintDto>(SprintErrors.NotPlanning);

        var alreadyActive = await db.Sprints.AnyAsync(
            s => s.ProjectId == sprint.ProjectId && s.Status == SprintStatus.Active && s.Id != sprint.Id, ct);
        if (alreadyActive)
            return Result.Failure<SprintDto>(SprintErrors.ActiveSprintExists);

        var tasks = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .Select(t => new ScopeBaselineTask(t.Id, t.Title, t.StoryPoints))
            .ToListAsync(ct);
        if (tasks.Count == 0)
            return Result.Failure<SprintDto>(SprintErrors.EmptyScope);

        sprint.ScopeBaselineJson = JsonSerializer.Serialize(tasks);
        sprint.Status = SprintStatus.Active;

        await db.SaveChangesAsync(ct);
        await events.PublishAsync(sprint.ProjectId, "sprint.changed",
            new { sprintId = sprint.Id, status = "Active" }, ct);

        var totalPts = tasks.Sum(t => t.StoryPoints ?? 0);
        return Result.Success(SprintMapper.ToDto(sprint, tasks.Count, totalPts, donePts: 0));
    }
}
