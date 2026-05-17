using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.Features.Sprints.Commands;

public record CreateSprintCommand(
    Guid ProjectId,
    string Name,
    string? Goal,
    DateTime StartDate,
    DateTime EndDate,
    int? VelocityTarget) : IRequest<Result<SprintDto>>;

public class CreateSprintCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateSprintCommand, Result<SprintDto>>
{
    public async Task<Result<SprintDto>> Handle(CreateSprintCommand request, CancellationToken ct)
    {
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 2 or > 120)
            return Result.Failure<SprintDto>(SprintErrors.InvalidName);
        if (request.EndDate <= request.StartDate)
            return Result.Failure<SprintDto>(SprintErrors.InvalidDates);

        var sprint = new Sprint
        {
            ProjectId = request.ProjectId,
            Name = name,
            Goal = request.Goal,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            VelocityTarget = request.VelocityTarget
        };
        db.Sprints.Add(sprint);
        await db.SaveChangesAsync(ct);

        return Result.Success(SprintMapper.ToDto(sprint, taskCount: 0, totalPts: 0, donePts: 0));
    }
}
