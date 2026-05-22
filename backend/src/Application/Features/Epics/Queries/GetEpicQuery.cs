using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Epics.Queries;

public record GetEpicQuery(Guid EpicId) : IRequest<Result<EpicDto>>;

public class GetEpicQueryHandler(IAppDbContext db)
    : IRequestHandler<GetEpicQuery, Result<EpicDto>>
{
    public async Task<Result<EpicDto>> Handle(GetEpicQuery request, CancellationToken ct)
    {
        var row = await db.Epics
            .Where(e => e.Id == request.EpicId)
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
            .FirstOrDefaultAsync(ct);

        if (row is null)
            return Result.Failure<EpicDto>(new Error("Epic.NotFound", "Epic not found."));

        var total = row.Tasks.Sum(t => t.StoryPoints ?? 0);
        var done = row.Tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);

        return Result.Success(new EpicDto(
            row.Id, row.ProjectId, row.Title, row.Description, row.OwnerId,
            row.Status, row.RiskFlag, row.Type, row.Color,
            row.CreatedAt, row.ArchivedAt,
            row.Tasks.Count, total, done));
    }
}
