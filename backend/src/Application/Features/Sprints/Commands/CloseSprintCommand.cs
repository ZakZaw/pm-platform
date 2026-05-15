using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Commands;

public record CloseSprintCommand(Guid SprintId, bool MoveCarryoversToBacklog = true)
    : IRequest<Result<SprintDto>>;

public class CloseSprintCommandHandler(IAppDbContext db)
    : IRequestHandler<CloseSprintCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(CloseSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null)
            return Result.Failure<SprintDto>(SprintErrors.NotFound);
        if (sprint.Status != SprintStatus.Active)
            return Result.Failure<SprintDto>(SprintErrors.NotActive);

        var stories = await db.Stories.Where(s => s.SprintId == sprint.Id).ToListAsync(ct);

        var donePts = stories.Where(s => s.Status == DomainTaskStatus.Done).Sum(s => s.StoryPoints ?? 0);

        if (request.MoveCarryoversToBacklog)
        {
            foreach (var s in stories)
            {
                if (s.Status != DomainTaskStatus.Done)
                {
                    s.SprintId = null;
                }
            }
        }

        sprint.FinalVelocity = donePts;
        sprint.Status = SprintStatus.Closed;
        sprint.ClosedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var totalPts = stories.Sum(s => s.StoryPoints ?? 0);
        return Result.Success(SprintMapper.ToDto(sprint, stories.Count, totalPts, donePts));
    }
}
