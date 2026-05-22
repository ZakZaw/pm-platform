using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Queries;

public record ListQueuesQuery(Guid ProjectId) : IRequest<Result<IReadOnlyList<QueueDto>>>;

public class ListQueuesQueryHandler(IAppDbContext db)
    : IRequestHandler<ListQueuesQuery, Result<IReadOnlyList<QueueDto>>>
{
    public async Task<Result<IReadOnlyList<QueueDto>>> Handle(
        ListQueuesQuery request, CancellationToken ct)
    {
        var queues = await db.Queues
            .Where(q => q.ProjectId == request.ProjectId)
            .OrderBy(q => q.Order)
            .ToListAsync(ct);

        var ids = queues.Select(q => q.Id).ToList();
        var openTickets = await db.Tickets
            .Where(t => ids.Contains(t.QueueId)
                        && t.Status != TicketStatus.Resolved
                        && t.Status != TicketStatus.Closed)
            .Select(t => new { t.QueueId, t.SlaDueAt })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var byQueue = openTickets
            .GroupBy(t => t.QueueId)
            .ToDictionary(g => g.Key, g => (
                Open: g.Count(),
                Breached: g.Count(x => x.SlaDueAt <= now)));

        var dtos = queues.Select(q =>
        {
            var (open, breached) = byQueue.GetValueOrDefault(q.Id);
            return new QueueDto(
                q.Id, q.ProjectId, q.Name, q.Order, q.SlaMinutes, q.DefaultAssigneeId,
                open, breached);
        }).ToList();

        return Result.Success<IReadOnlyList<QueueDto>>(dtos);
    }
}
