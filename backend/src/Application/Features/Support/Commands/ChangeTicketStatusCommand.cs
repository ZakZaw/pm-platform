using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

/// <summary>
/// Moves a ticket through its lifecycle. Stamps timestamps as side
/// effects: ResolvedAt on Resolved, ClosedAt on Closed; cleared on
/// Reopened. Free transitions in the current iteration (the design
/// document allows any → any for engineering tasks; support follows
/// the same rule until business pressure says otherwise).
/// </summary>
public record ChangeTicketStatusCommand(Guid TicketId, string ToStatus)
    : IRequest<Result<TicketDto>>;

public class ChangeTicketStatusCommandHandler(IAppDbContext db)
    : IRequestHandler<ChangeTicketStatusCommand, Result<TicketDto>>
{
    public async Task<Result<TicketDto>> Handle(
        ChangeTicketStatusCommand request, CancellationToken ct)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == request.TicketId, ct);
        if (ticket is null) return Result.Failure<TicketDto>(SupportErrors.TicketNotFound);

        if (!Enum.TryParse<TicketStatus>(request.ToStatus, ignoreCase: true, out var to))
            return Result.Failure<TicketDto>(SupportErrors.InvalidTicketStatus);

        ticket.Status = to;
        var now = DateTime.UtcNow;
        switch (to)
        {
            case TicketStatus.Resolved:
                ticket.ResolvedAt = now;
                ticket.ClosedAt = null;
                break;
            case TicketStatus.Closed:
                if (ticket.ResolvedAt is null) ticket.ResolvedAt = now;
                ticket.ClosedAt = now;
                break;
            case TicketStatus.Reopened:
            case TicketStatus.New:
            case TicketStatus.Open:
            case TicketStatus.Pending:
                ticket.ResolvedAt = null;
                ticket.ClosedAt = null;
                break;
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
            enriched.t.SlaDueAt <= now
                && enriched.t.Status != TicketStatus.Resolved
                && enriched.t.Status != TicketStatus.Closed));
    }
}
