using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sprints.Retrospective;

public record GetSprintRetrospectiveQuery(Guid SprintId)
    : IRequest<Result<SprintRetrospectiveDto>>;

public class GetSprintRetrospectiveQueryHandler(IAppDbContext db)
    : IRequestHandler<GetSprintRetrospectiveQuery, Result<SprintRetrospectiveDto>>
{
    public async Task<Result<SprintRetrospectiveDto>> Handle(
        GetSprintRetrospectiveQuery request, CancellationToken ct)
    {
        var entity = await db.SprintRetrospectives
            .FirstOrDefaultAsync(r => r.SprintId == request.SprintId, ct);
        if (entity is null) return Result.Failure<SprintRetrospectiveDto>(SprintErrors.RetroNotFound);

        // Resolve every picked task to its current key + title so the
        // page can render rows even if priorities have shifted since
        // generation. Tasks deleted between generate and view fall back
        // to "(task removed)".
        var draft = RetrospectiveMapper.ParseDraft(entity);
        var lookup = new Dictionary<Guid, RetrospectiveMapper.TaskKeyAndTitle>();
        if (draft is { Tasks: { Count: > 0 } picks })
        {
            var ids = picks.Select(p => p.TaskId).Distinct().ToList();
            var sprint = await db.Sprints
                .Where(s => s.Id == entity.SprintId)
                .Select(s => new { s.ProjectId })
                .FirstAsync(ct);
            var projectKey = await db.Projects
                .Where(p => p.Id == sprint.ProjectId)
                .Select(p => p.Key)
                .FirstAsync(ct);
            var rows = await db.Tasks
                .Where(t => ids.Contains(t.Id))
                .Select(t => new { t.Id, t.KeyNum, t.Title, t.StoryPoints })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                lookup[r.Id] = new RetrospectiveMapper.TaskKeyAndTitle(
                    r.Id, $"{projectKey}-{r.KeyNum}", r.Title, r.StoryPoints ?? 0);
            }
        }

        return Result.Success(RetrospectiveMapper.ToDto(entity, lookup));
    }
}
