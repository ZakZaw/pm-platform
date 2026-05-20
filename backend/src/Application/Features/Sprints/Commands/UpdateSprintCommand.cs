using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Commands;

public record UpdateSprintCommand(
    Guid SprintId,
    string? Name,
    DateTime? StartDate,
    DateTime? EndDate,
    int? VelocityTarget,
    bool ClearVelocityTarget) : IRequest<Result<SprintDto>>;

public class UpdateSprintCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateSprintCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(UpdateSprintCommand request, CancellationToken ct)
    {
        var sprint = await db.Sprints.FirstOrDefaultAsync(s => s.Id == request.SprintId, ct);
        if (sprint is null)
            return Result.Failure<SprintDto>(SprintErrors.NotFound);

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length is < 2 or > 120)
                return Result.Failure<SprintDto>(SprintErrors.InvalidName);
            sprint.Name = name;
        }

        var newStart = request.StartDate ?? sprint.StartDate;
        var newEnd = request.EndDate ?? sprint.EndDate;
        if (newEnd <= newStart)
            return Result.Failure<SprintDto>(SprintErrors.InvalidDates);
        sprint.StartDate = newStart;
        sprint.EndDate = newEnd;

        if (request.ClearVelocityTarget) sprint.VelocityTarget = null;
        else if (request.VelocityTarget.HasValue) sprint.VelocityTarget = request.VelocityTarget;

        await db.SaveChangesAsync(ct);

        var tasks = await db.Tasks
            .Where(t => t.SprintId == sprint.Id)
            .Select(t => new { t.StoryPoints, t.Status })
            .ToListAsync(ct);
        var total = tasks.Sum(t => t.StoryPoints ?? 0);
        var done = tasks
            .Where(t => t.Status == DomainTaskStatus.Done)
            .Sum(t => t.StoryPoints ?? 0);

        return Result.Success(SprintMapper.ToDto(sprint, tasks.Count, total, done));
    }
}
