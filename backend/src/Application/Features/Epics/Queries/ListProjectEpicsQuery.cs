using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Epics.Queries;

public record ListProjectEpicsQuery(Guid ProjectId, bool IncludeArchived = false)
    : IRequest<Result<IReadOnlyList<EpicDto>>>;

public class ListProjectEpicsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectEpicsQuery, Result<IReadOnlyList<EpicDto>>>
{
    public async Task<Result<IReadOnlyList<EpicDto>>> Handle(ListProjectEpicsQuery request, CancellationToken ct)
    {
        var q = db.Epics.Where(e => e.ProjectId == request.ProjectId);
        if (!request.IncludeArchived) q = q.Where(e => e.ArchivedAt == null);

        var rows = await q
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new
            {
                e.Id,
                e.ProjectId,
                e.Title,
                e.Description,
                e.OwnerId,
                Status = e.Status.ToString(),
                e.RiskFlag,
                Type = e.Type.HasValue ? e.Type.Value.ToString() : null,
                e.Color,
                e.CreatedAt,
                e.ArchivedAt,
                Tasks = db.Tasks.Where(t => t.EpicId == e.Id)
                    .Select(t => new { t.StoryPoints, t.Status }).ToList()
            })
            .ToListAsync(ct);

        var list = rows.Select(r =>
        {
            var total = r.Tasks.Sum(t => t.StoryPoints ?? 0);
            var done = r.Tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);
            return new EpicDto(
                r.Id, r.ProjectId, r.Title, r.Description, r.OwnerId,
                r.Status, r.RiskFlag, r.Type, r.Color,
                r.CreatedAt, r.ArchivedAt,
                r.Tasks.Count, total, done);
        }).ToList();

        return Result.Success<IReadOnlyList<EpicDto>>(list);
    }
}
