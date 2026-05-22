using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record CreateTicketCommand(
    Guid ProjectId,
    Guid CustomerId,
    Guid? QueueId,
    string Subject,
    string? BodyMd,
    string? Priority,
    Guid? AssigneeId) : IRequest<Result<TicketDto>>;

public class CreateTicketCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateTicketCommand, Result<TicketDto>>
{
    public async Task<Result<TicketDto>> Handle(CreateTicketCommand request, CancellationToken ct)
    {
        var subject = request.Subject?.Trim() ?? string.Empty;
        if (subject.Length is < 1 or > 300)
            return Result.Failure<TicketDto>(SupportErrors.InvalidTicketSubject);

        var customer = await db.Customers
            .Where(c => c.Id == request.CustomerId)
            .Select(c => new { c.Id, c.ProjectId, c.Name, c.Tier })
            .FirstOrDefaultAsync(ct);
        if (customer is null) return Result.Failure<TicketDto>(SupportErrors.CustomerNotFound);
        if (customer.ProjectId != request.ProjectId)
            return Result.Failure<TicketDto>(SupportErrors.CustomerNotInProject);

        // Default to the first queue if the caller didn't pick one.
        Queue? queue;
        if (request.QueueId is { } qid)
        {
            queue = await db.Queues
                .FirstOrDefaultAsync(q => q.Id == qid && q.ProjectId == request.ProjectId, ct);
            if (queue is null) return Result.Failure<TicketDto>(SupportErrors.QueueNotInProject);
        }
        else
        {
            queue = await db.Queues
                .Where(q => q.ProjectId == request.ProjectId)
                .OrderBy(q => q.Order)
                .FirstOrDefaultAsync(ct);
            if (queue is null) return Result.Failure<TicketDto>(SupportErrors.QueueNotFound);
        }

        var priority = Priority.Medium;
        if (!string.IsNullOrWhiteSpace(request.Priority))
        {
            if (!Enum.TryParse<Priority>(request.Priority, ignoreCase: true, out priority))
                priority = Priority.Medium;
        }

        var openedAt = DateTime.UtcNow;
        var ticket = new Ticket
        {
            ProjectId = request.ProjectId,
            CustomerId = customer.Id,
            QueueId = queue.Id,
            Subject = subject,
            BodyMd = request.BodyMd,
            Status = TicketStatus.New,
            Priority = priority,
            AssigneeId = request.AssigneeId ?? queue.DefaultAssigneeId,
            OpenedAt = openedAt,
            SlaDueAt = openedAt.AddMinutes(queue.SlaMinutes),
        };
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TicketDto(
            ticket.Id, ticket.ProjectId, ticket.CustomerId, customer.Name, customer.Tier,
            ticket.QueueId, queue.Name,
            ticket.Subject, ticket.BodyMd,
            ticket.Status.ToString(), ticket.Priority.ToString(),
            ticket.AssigneeId,
            ticket.OpenedAt, ticket.SlaDueAt,
            ticket.FirstResponseAt, ticket.ResolvedAt, ticket.ClosedAt,
            ReplyCount: 0,
            IsBreached: ticket.SlaDueAt <= DateTime.UtcNow));
    }
}
