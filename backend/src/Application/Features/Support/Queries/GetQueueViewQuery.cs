using System.Text.Json;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Queries;

/// <summary>
/// Returns every queue in a Support project with its open tickets,
/// ordered by SLA urgency. On the way out, emits a one-time AI Inbox
/// card for any newly-breached ticket — that satisfies F1.5-03 AC #2
/// without standing up a background worker (the next queue load /
/// inbox poll will surface the card).
/// </summary>
public record GetQueueViewQuery(Guid ProjectId) : IRequest<Result<QueueViewResponseDto>>;

public class GetQueueViewQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetQueueViewQuery, Result<QueueViewResponseDto>>
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<Result<QueueViewResponseDto>> Handle(
        GetQueueViewQuery request, CancellationToken ct)
    {
        var queues = await db.Queues
            .Where(q => q.ProjectId == request.ProjectId)
            .OrderBy(q => q.Order)
            .ToListAsync(ct);

        if (queues.Count == 0)
            return Result.Success(new QueueViewResponseDto(Array.Empty<QueueViewDto>()));

        var tickets = await db.Tickets
            .Where(t => t.ProjectId == request.ProjectId
                        && t.Status != TicketStatus.Resolved
                        && t.Status != TicketStatus.Closed)
            .Join(db.Customers, t => t.CustomerId, c => c.Id,
                (t, c) => new { Ticket = t, CustomerName = c.Name, CustomerTier = c.Tier })
            .Join(db.Queues, x => x.Ticket.QueueId, q => q.Id,
                (x, q) => new { x.Ticket, x.CustomerName, x.CustomerTier, QueueName = q.Name, QueueId = q.Id })
            .ToListAsync(ct);

        var replyCounts = await db.TicketReplies
            .Where(r => tickets.Select(x => x.Ticket.Id).Contains(r.TicketId))
            .GroupBy(r => r.TicketId)
            .Select(g => new { TicketId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.TicketId, g => g.Count, ct);

        var now = DateTime.UtcNow;
        var newlyBreached = tickets
            .Select(x => x.Ticket)
            .Where(t => t.SlaDueAt <= now && !t.SlaBreachNotified)
            .ToList();

        if (newlyBreached.Count > 0 && currentUser.UserId is { } userId)
        {
            foreach (var t in newlyBreached)
            {
                t.SlaBreachNotified = true;
                var queue = queues.First(q => q.Id == t.QueueId);
                db.AISuggestions.Add(new AISuggestion
                {
                    ProjectId = t.ProjectId,
                    Kind = "support.sla.breach",
                    Title = $"SLA breach — {t.Subject}",
                    Body = $"Ticket in {queue.Name} has missed its {queue.SlaMinutes}-minute SLA.",
                    PayloadJson = JsonSerializer.Serialize(new
                    {
                        ticketId = t.Id,
                        queueId = t.QueueId,
                        queueName = queue.Name,
                        slaMinutes = queue.SlaMinutes,
                        openedAt = t.OpenedAt,
                        slaDueAt = t.SlaDueAt,
                    }, JsonOpts),
                    CreatedByUserId = userId,
                });
            }
            await db.SaveChangesAsync(ct);
        }

        var ticketsByQueue = tickets
            .GroupBy(x => x.QueueId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var queueViews = queues.Select(q =>
        {
            var qTickets = ticketsByQueue.GetValueOrDefault(q.Id) ?? new();
            // Most urgent first (breached + closest to due), then by priority,
            // then by opened time so the oldest unattended ticket bubbles up.
            var ordered = qTickets
                .OrderBy(x => x.Ticket.SlaDueAt)
                .ThenByDescending(x => x.Ticket.Priority)
                .ThenBy(x => x.Ticket.OpenedAt)
                .ToList();
            var ticketDtos = ordered.Select(x => new TicketDto(
                x.Ticket.Id, x.Ticket.ProjectId, x.Ticket.CustomerId,
                x.CustomerName, x.CustomerTier,
                x.Ticket.QueueId, x.QueueName,
                x.Ticket.Subject, x.Ticket.BodyMd,
                x.Ticket.Status.ToString(), x.Ticket.Priority.ToString(),
                x.Ticket.AssigneeId,
                x.Ticket.OpenedAt, x.Ticket.SlaDueAt,
                x.Ticket.FirstResponseAt, x.Ticket.ResolvedAt, x.Ticket.ClosedAt,
                replyCounts.GetValueOrDefault(x.Ticket.Id),
                x.Ticket.SlaDueAt <= now)).ToList();
            return new QueueViewDto(
                q.Id, q.Name, q.Order, q.SlaMinutes,
                ticketDtos.Count,
                ticketDtos.Count(t => t.IsBreached),
                ticketDtos);
        }).ToList();

        return Result.Success(new QueueViewResponseDto(queueViews));
    }
}
