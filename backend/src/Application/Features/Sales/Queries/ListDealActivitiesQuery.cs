using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Sales.Queries;

public record ListDealActivitiesQuery(Guid DealId)
    : IRequest<Result<IReadOnlyList<ActivityDto>>>;

public class ListDealActivitiesQueryHandler(IAppDbContext db)
    : IRequestHandler<ListDealActivitiesQuery, Result<IReadOnlyList<ActivityDto>>>
{
    public async Task<Result<IReadOnlyList<ActivityDto>>> Handle(
        ListDealActivitiesQuery request, CancellationToken ct)
    {
        var rows = await db.Activities
            .Where(a => a.DealId == request.DealId)
            .OrderByDescending(a => a.OccurredAt)
            .Select(a => new ActivityDto(
                a.Id, a.DealId, a.Type.ToString(),
                a.Summary, a.OccurredAt, a.OwnerId, a.CreatedAt))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<ActivityDto>>(rows);
    }
}
