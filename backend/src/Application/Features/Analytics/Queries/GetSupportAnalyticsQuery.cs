using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Analytics.Queries;

/// <summary>
/// Support project dashboard analytics — live open + breached counts, the
/// per-queue split, and the trailing-30-day SLA attainment (resolved within
/// SLA). Attainment math lives in the pure <see cref="SlaAttainmentCalculator"/>.
/// </summary>
public record GetSupportAnalyticsQuery(Guid ProjectId) : IRequest<Result<SupportAnalyticsDto>>;

public class GetSupportAnalyticsQueryHandler(IAppDbContext db)
    : IRequestHandler<GetSupportAnalyticsQuery, Result<SupportAnalyticsDto>>
{
    private const int AttainmentWindowDays = 30;
    private const int MaxBreaches = 6;

    public async Task<Result<SupportAnalyticsDto>> Handle(GetSupportAnalyticsQuery request, CancellationToken ct)
    {
        var queues = await db.Queues
            .Where(q => q.ProjectId == request.ProjectId)
            .OrderBy(q => q.Order)
            .Select(q => new { q.Id, q.Name })
            .ToListAsync(ct);

        var tickets = await db.Tickets
            .Where(t => t.ProjectId == request.ProjectId)
            .Select(t => new { t.Id, t.Subject, t.QueueId, t.Status, t.SlaDueAt, t.ResolvedAt })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var queueName = queues.ToDictionary(q => q.Id, q => q.Name);

        static bool IsOpen(TicketStatus s) => s != TicketStatus.Resolved && s != TicketStatus.Closed;

        var open = tickets.Where(t => IsOpen(t.Status)).ToList();
        var breachedOpen = open.Where(t => t.SlaDueAt < now).ToList();

        var queueDtos = queues
            .Select(q =>
            {
                var inQueue = open.Where(t => t.QueueId == q.Id).ToList();
                return new SupportQueueDto(q.Id, q.Name, inQueue.Count, inQueue.Count(t => t.SlaDueAt < now));
            })
            .ToList();

        // SLA attainment over recently resolved tickets.
        var cutoff = now.AddDays(-AttainmentWindowDays);
        var resolved = tickets
            .Where(t => t.ResolvedAt is { } r && r >= cutoff)
            .Select(t => (t.ResolvedAt!.Value, t.SlaDueAt))
            .ToList();
        var attainment = SlaAttainmentCalculator.AttainmentPct(resolved);

        var breaches = breachedOpen
            .OrderBy(t => t.SlaDueAt)
            .Take(MaxBreaches)
            .Select(t => new SupportBreachDto(
                t.Id, t.Subject, queueName.GetValueOrDefault(t.QueueId, "—"), t.SlaDueAt))
            .ToList();

        return Result.Success(new SupportAnalyticsDto(
            open.Count,
            breachedOpen.Count,
            attainment,
            resolved.Count,
            queueDtos,
            breaches));
    }
}
