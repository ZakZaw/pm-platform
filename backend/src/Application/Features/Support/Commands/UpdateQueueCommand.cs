using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record UpdateQueueCommand(
    Guid QueueId,
    string? Name,
    int? SlaMinutes,
    Guid? DefaultAssigneeId) : IRequest<Result<QueueDto>>;

public class UpdateQueueCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateQueueCommand, Result<QueueDto>>
{
    public async Task<Result<QueueDto>> Handle(UpdateQueueCommand request, CancellationToken ct)
    {
        var queue = await db.Queues.FirstOrDefaultAsync(q => q.Id == request.QueueId, ct);
        if (queue is null) return Result.Failure<QueueDto>(SupportErrors.QueueNotFound);

        if (request.Name is not null)
        {
            var n = request.Name.Trim();
            if (n.Length is < 1 or > 60)
                return Result.Failure<QueueDto>(SupportErrors.InvalidQueueName);
            queue.Name = n;
        }
        if (request.SlaMinutes is { } sla)
        {
            if (sla <= 0) return Result.Failure<QueueDto>(SupportErrors.InvalidSla);
            // Don't retroactively shift SlaDueAt on existing tickets — the
            // SLA they were opened against is the contract that counts.
            queue.SlaMinutes = sla;
        }
        if (request.DefaultAssigneeId.HasValue) queue.DefaultAssigneeId = request.DefaultAssigneeId;

        await db.SaveChangesAsync(ct);

        var now = DateTime.UtcNow;
        var open = await db.Tickets
            .Where(t => t.QueueId == queue.Id
                        && t.Status != TicketStatus.Resolved
                        && t.Status != TicketStatus.Closed)
            .Select(t => t.SlaDueAt)
            .ToListAsync(ct);

        return Result.Success(new QueueDto(
            queue.Id, queue.ProjectId, queue.Name, queue.Order, queue.SlaMinutes,
            queue.DefaultAssigneeId,
            open.Count,
            open.Count(d => d <= now)));
    }
}
