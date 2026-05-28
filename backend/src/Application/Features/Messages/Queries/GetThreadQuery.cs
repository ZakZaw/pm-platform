using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Queries;

/// <summary>
/// Fetch a thread: the parent message plus every visible reply in
/// chronological order. Access is gated on the parent's channel
/// membership, same as the feed query.
/// </summary>
public record GetThreadQuery(Guid ParentMessageId)
    : IRequest<Result<ThreadDto>>;

public record ThreadDto(MessageDto Parent, IReadOnlyList<MessageDto> Replies);

public class GetThreadQueryHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetThreadQuery, Result<ThreadDto>>
{
    public async Task<Result<ThreadDto>> Handle(GetThreadQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ThreadDto>(AuthErrors.NotAuthenticated);

        var parent = await db.Messages
            .Where(m => m.Id == request.ParentMessageId && m.ParentMessageId == null)
            .Select(m => new { m.Id, m.ChannelId })
            .FirstOrDefaultAsync(ct);
        if (parent is null)
            return Result.Failure<ThreadDto>(MessageErrors.NotFound);

        var gate = await ChannelAccessGate.ResolveAsync(db, parent.ChannelId, userId, ct);
        if (!gate.IsSuccess)
            return Result.Failure<ThreadDto>(gate.Error!);

        var replyIds = await db.Messages
            .Where(m => m.ParentMessageId == parent.Id)
            .OrderBy(m => m.CreatedAt)
            .Select(m => m.Id)
            .ToListAsync(ct);

        var all = await MessageProjection.LoadAsync(db, [parent.Id, .. replyIds], ct);
        var parentDto = all.First(m => m.Id == parent.Id);
        var replies = all
            .Where(m => m.Id != parent.Id)
            .OrderBy(m => m.CreatedAt)
            .ToList();

        return Result.Success(new ThreadDto(parentDto, replies));
    }
}
