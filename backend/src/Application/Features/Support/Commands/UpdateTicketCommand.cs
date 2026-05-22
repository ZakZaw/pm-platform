using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record UpdateTicketCommand(
    Guid TicketId,
    string? Subject,
    string? BodyMd,
    string? Priority,
    Guid? AssigneeId,
    Guid? QueueId) : IRequest<Result<TicketDto>>;

public class UpdateTicketCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateTicketCommand, Result<TicketDto>>
{
    public async Task<Result<TicketDto>> Handle(UpdateTicketCommand request, CancellationToken ct)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == request.TicketId, ct);
        if (ticket is null) return Result.Failure<TicketDto>(SupportErrors.TicketNotFound);

        if (request.Subject is not null)
        {
            var s = request.Subject.Trim();
            if (s.Length is < 1 or > 300)
                return Result.Failure<TicketDto>(SupportErrors.InvalidTicketSubject);
            ticket.Subject = s;
        }
        if (request.BodyMd is not null) ticket.BodyMd = request.BodyMd;
        if (!string.IsNullOrWhiteSpace(request.Priority)
            && Enum.TryParse<Priority>(request.Priority, ignoreCase: true, out var p))
            ticket.Priority = p;
        if (request.AssigneeId.HasValue) ticket.AssigneeId = request.AssigneeId;

        if (request.QueueId is { } qid && qid != ticket.QueueId)
        {
            var queue = await db.Queues
                .FirstOrDefaultAsync(q => q.Id == qid && q.ProjectId == ticket.ProjectId, ct);
            if (queue is null) return Result.Failure<TicketDto>(SupportErrors.QueueNotInProject);
            ticket.QueueId = qid;
            // The SLA the ticket was opened against stays — moving queues
            // doesn't reset the clock, otherwise teams could dodge SLAs
            // by re-routing breached tickets.
        }

        await db.SaveChangesAsync(ct);

        var enriched = await db.Tickets
            .Where(t => t.Id == ticket.Id)
            .Select(t => new {
                t,
                CustomerName = t.Customer.Name,
                CustomerTier = t.Customer.Tier,
                QueueName = t.Queue.Name,
                ReplyCount = t.Replies.Count(),
            })
            .FirstAsync(ct);

        return Result.Success(new TicketDto(
            enriched.t.Id, enriched.t.ProjectId, enriched.t.CustomerId,
            enriched.CustomerName, enriched.CustomerTier,
            enriched.t.QueueId, enriched.QueueName,
            enriched.t.Subject, enriched.t.BodyMd,
            enriched.t.Status.ToString(), enriched.t.Priority.ToString(),
            enriched.t.AssigneeId,
            enriched.t.OpenedAt, enriched.t.SlaDueAt,
            enriched.t.FirstResponseAt, enriched.t.ResolvedAt, enriched.t.ClosedAt,
            enriched.ReplyCount,
            enriched.t.SlaDueAt <= DateTime.UtcNow
                && enriched.t.Status != TicketStatus.Resolved
                && enriched.t.Status != TicketStatus.Closed));
    }
}
