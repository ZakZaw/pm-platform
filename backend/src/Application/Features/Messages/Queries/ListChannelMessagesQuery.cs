using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Queries;

/// <summary>
/// Top-level message feed for a channel, most-recent-first then
/// reversed client-side. <see cref="BeforeId"/> drives the infinite-
/// scroll pager: pass the oldest visible message's id to fetch the
/// page that precedes it.
/// </summary>
public record ListChannelMessagesQuery(
    Guid ChannelId, Guid? BeforeId, int Limit = 50)
    : IRequest<Result<ChannelMessagePageDto>>;

public record ChannelMessagePageDto(
    IReadOnlyList<MessageDto> Items,
    bool HasMore);

public class ListChannelMessagesQueryHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListChannelMessagesQuery, Result<ChannelMessagePageDto>>
{
    public const int MaxLimit = 100;
    public const int DefaultLimit = 50;

    public async Task<Result<ChannelMessagePageDto>> Handle(
        ListChannelMessagesQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ChannelMessagePageDto>(AuthErrors.NotAuthenticated);

        var gate = await ChannelAccessGate.ResolveAsync(db, request.ChannelId, userId, ct);
        if (!gate.IsSuccess)
            return Result.Failure<ChannelMessagePageDto>(gate.Error!);

        var limit = Math.Clamp(request.Limit <= 0 ? DefaultLimit : request.Limit, 1, MaxLimit);

        // Pull the cursor's CreatedAt up front so the "before" check
        // can use the indexed (ChannelId, CreatedAt) lookup, not a
        // self-join.
        DateTime? beforeAt = null;
        if (request.BeforeId is { } beforeId)
        {
            beforeAt = await db.Messages
                .Where(m => m.Id == beforeId && m.ChannelId == request.ChannelId)
                .Select(m => (DateTime?)m.CreatedAt)
                .FirstOrDefaultAsync(ct);
        }

        var query = db.Messages
            .Where(m => m.ChannelId == request.ChannelId && m.ParentMessageId == null);
        if (beforeAt is { } cutoff)
            query = query.Where(m => m.CreatedAt < cutoff);

        // limit+1 so we can detect "more pages exist" without a second
        // count query.
        var rows = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit + 1)
            .Select(m => m.Id)
            .ToListAsync(ct);

        var hasMore = rows.Count > limit;
        var ids = rows.Take(limit).ToList();
        var items = await MessageProjection.LoadAsync(db, ids, ct);

        // Caller renders bottom-to-top — flip to chronological order
        // here so React doesn't have to deal with two orderings.
        items.Sort((a, b) => a.CreatedAt.CompareTo(b.CreatedAt));

        return Result.Success(new ChannelMessagePageDto(items, hasMore));
    }
}
