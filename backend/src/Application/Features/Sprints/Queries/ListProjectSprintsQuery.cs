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
                Stories = db.Stories.Where(st => st.SprintId == s.Id)
                    .Select(st => new { st.StoryPoints, st.Status }).ToList()
            })
            .ToListAsync(ct);

        var dtos = rows.Select(r =>
        {
            var total = r.Stories.Sum(s => s.StoryPoints ?? 0);
            var done = r.Stories.Where(s => s.Status == DomainTaskStatus.Done).Sum(s => s.StoryPoints ?? 0);
            return SprintMapper.ToDto(r.Sprint, r.Stories.Count, total, done);
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

        var stories = await db.Stories.Where(s => s.SprintId == sprint.Id)
            .Select(s => new { s.StoryPoints, s.Status }).ToListAsync(ct);
        var total = stories.Sum(s => s.StoryPoints ?? 0);
        var done = stories.Where(s => s.Status == DomainTaskStatus.Done).Sum(s => s.StoryPoints ?? 0);

        return Result.Success<SprintDto?>(SprintMapper.ToDto(sprint, stories.Count, total, done));
    }
}
