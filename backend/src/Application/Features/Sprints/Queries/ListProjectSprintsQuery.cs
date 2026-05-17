using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Sprints.Queries;

public record ListProjectSprintsQuery(Guid ProjectId) : IRequest<Result<IReadOnlyList<SprintDto>>>;

public class ListProjectSprintsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectSprintsQuery, Result<IReadOnlyList<SprintDto>>>
{
    public async Task<Result<IReadOnlyList<SprintDto>>> Handle(ListProjectSprintsQuery request, CancellationToken ct)
    {
        var rows = await db.Sprints
            .Where(s => s.ProjectId == request.ProjectId)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new
            {
                Sprint = s,
                Tasks = db.Tasks.Where(t => t.SprintId == s.Id)
                    .Select(t => new { t.StoryPoints, t.Status }).ToList()
            })
            .ToListAsync(ct);

        var dtos = rows.Select(r =>
        {
            var total = r.Tasks.Sum(t => t.StoryPoints ?? 0);
            var done = r.Tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);
            return SprintMapper.ToDto(r.Sprint, r.Tasks.Count, total, done);
        }).ToList();

        return Result.Success<IReadOnlyList<SprintDto>>(dtos);
    }
}

public record GetActiveSprintQuery(Guid ProjectId) : IRequest<Result<SprintDto?>>;

public class GetActiveSprintQueryHandler(IAppDbContext db)
    : IRequestHandler<GetActiveSprintQuery, Result<SprintDto?>>
{
    public async Task<Result<SprintDto?>> Handle(GetActiveSprintQuery request, CancellationToken ct)
    {
        var sprint = await db.Sprints
            .Where(s => s.ProjectId == request.ProjectId && s.Status == Domain.Enums.SprintStatus.Active)
            .FirstOrDefaultAsync(ct);
        if (sprint is null) return Result.Success<SprintDto?>(null);

        var tasks = await db.Tasks.Where(t => t.SprintId == sprint.Id)
            .Select(t => new { t.StoryPoints, t.Status }).ToListAsync(ct);
        var total = tasks.Sum(t => t.StoryPoints ?? 0);
        var done = tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);

        return Result.Success<SprintDto?>(SprintMapper.ToDto(sprint, tasks.Count, total, done));
    }
}
