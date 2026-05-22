using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Support.Commands;

public record AddTicketReplyCommand(
    Guid TicketId,
    string BodyMd,
    bool IsInternal) : IRequest<Result<TicketReplyDto>>;

public class AddTicketReplyCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AddTicketReplyCommand, Result<TicketReplyDto>>
{
    public async Task<Result<TicketReplyDto>> Handle(
        AddTicketReplyCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TicketReplyDto>(AuthErrors.NotAuthenticated);

        var body = request.BodyMd?.Trim() ?? string.Empty;
        if (body.Length is < 1 or > 10_000)
            return Result.Failure<TicketReplyDto>(SupportErrors.InvalidReplyBody);

        var ticket = await db.Tickets.FirstOrDefaultAsync(t => t.Id == request.TicketId, ct);
        if (ticket is null) return Result.Failure<TicketReplyDto>(SupportErrors.TicketNotFound);

        var reply = new TicketReply
        {
            TicketId = ticket.Id,
            AuthorId = userId,
            BodyMd = body,
            IsInternal = request.IsInternal,
        };
        db.TicketReplies.Add(reply);

        // First non-internal reply stamps FirstResponseAt — the SLA-related
        // signal the queue view cares about. Internal notes don't count.
        if (!request.IsInternal && ticket.FirstResponseAt is null)
            ticket.FirstResponseAt = reply.CreatedAt;

        // New / Reopened → Open on the first reply, so a working ticket
        // doesn't sit in the New column forever.
        if (ticket.Status is TicketStatus.New or TicketStatus.Reopened)
            ticket.Status = TicketStatus.Open;

        await db.SaveChangesAsync(ct);

        return Result.Success(new TicketReplyDto(
            reply.Id, reply.TicketId, reply.AuthorId,
            reply.BodyMd, reply.IsInternal,
            reply.CreatedAt, reply.EditedAt));
    }
}
