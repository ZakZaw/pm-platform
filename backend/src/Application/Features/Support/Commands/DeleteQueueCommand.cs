using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record DeleteQueueCommand(Guid QueueId) : IRequest<Result>;

public class DeleteQueueCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteQueueCommand, Result>
{
    public async Task<Result> Handle(DeleteQueueCommand request, CancellationToken ct)
    {
        var queue = await db.Queues.FirstOrDefaultAsync(q => q.Id == request.QueueId, ct);
        if (queue is null) return Result.Failure(SupportErrors.QueueNotFound);

        var hasTickets = await db.Tickets.AnyAsync(t => t.QueueId == queue.Id, ct);
        if (hasTickets) return Result.Failure(SupportErrors.CannotDeleteQueueWithTickets);

        db.Queues.Remove(queue);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
