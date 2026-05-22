using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Queries;

public record GetTicketQuery(Guid TicketId, bool IncludeInternal = true)
    : IRequest<Result<TicketDetailDto>>;

public record TicketDetailDto(TicketDto Ticket, IReadOnlyList<TicketReplyDto> Replies);

public class GetTicketQueryHandler(IAppDbContext db)
    : IRequestHandler<GetTicketQuery, Result<TicketDetailDto>>
{
    public async Task<Result<TicketDetailDto>> Handle(
        GetTicketQuery request, CancellationToken ct)
    {
        var row = await db.Tickets
            .Where(t => t.Id == request.TicketId)
            .Select(t => new {
                t,
                CustomerName = t.Customer.Name,
                CustomerTier = t.Customer.Tier,
                QueueName = t.Queue.Name,
                ReplyCount = t.Replies.Count(),
            })
            .FirstOrDefaultAsync(ct);

        if (row is null) return Result.Failure<TicketDetailDto>(SupportErrors.TicketNotFound);

        var repliesQuery = db.TicketReplies
            .Where(r => r.TicketId == row.t.Id);
        if (!request.IncludeInternal)
            repliesQuery = repliesQuery.Where(r => !r.IsInternal);

        var replies = await repliesQuery
            .OrderBy(r => r.CreatedAt)
            .Select(r => new TicketReplyDto(
                r.Id, r.TicketId, r.AuthorId,
                r.BodyMd, r.IsInternal,
                r.CreatedAt, r.EditedAt))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var dto = new TicketDto(
            row.t.Id, row.t.ProjectId, row.t.CustomerId,
            row.CustomerName, row.CustomerTier,
            row.t.QueueId, row.QueueName,
            row.t.Subject, row.t.BodyMd,
            row.t.Status.ToString(), row.t.Priority.ToString(),
            row.t.AssigneeId,
            row.t.OpenedAt, row.t.SlaDueAt,
            row.t.FirstResponseAt, row.t.ResolvedAt, row.t.ClosedAt,
            row.ReplyCount,
            row.t.SlaDueAt <= now
                && row.t.Status != TicketStatus.Resolved
                && row.t.Status != TicketStatus.Closed);

        return Result.Success(new TicketDetailDto(dto, replies));
    }
}
