using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Commands;

/// <summary>
/// Post a new message to a channel. When <see cref="ParentMessageId"/>
/// is set, the new row becomes a reply in the parent's thread; replies
/// of replies collapse to the same parent (we only support one level).
/// Posting bumps the channel's <c>LastActivityAt</c> so the sidebar
/// row sorts to the top and the unread badge fires.
/// </summary>
public record PostMessageCommand(
    Guid ChannelId,
    Guid? ParentMessageId,
    string BodyMd) : IRequest<Result<MessageDto>>;

public class PostMessageCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IProjectEventBus events)
    : IRequestHandler<PostMessageCommand, Result<MessageDto>>
{
    public const int MaxBodyLength = 10_000;

    public async Task<Result<MessageDto>> Handle(PostMessageCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MessageDto>(AuthErrors.NotAuthenticated);

        var body = (request.BodyMd ?? string.Empty).Trim();
        if (body.Length == 0)
            return Result.Failure<MessageDto>(MessageErrors.EmptyBody);
        if (body.Length > MaxBodyLength)
            return Result.Failure<MessageDto>(MessageErrors.TooLong);

        var gate = await ChannelAccessGate.ResolveAsync(db, request.ChannelId, userId, ct);
        if (!gate.IsSuccess)
            return Result.Failure<MessageDto>(gate.Error!);
        var channel = gate.Value!;
        if (channel.ArchivedAt is not null)
            return Result.Failure<MessageDto>(ChannelErrors.Archived);

        // If a parent is named, normalise: it must live in this channel,
        // not be soft-deleted, and itself be a top-level message. Replies
        // to replies attach to the same parent — which is what most chat
        // apps do.
        Guid? parentId = null;
        if (request.ParentMessageId is { } pid)
        {
            var parent = await db.Messages
                .Where(m => m.Id == pid && m.ChannelId == request.ChannelId)
                .Select(m => new { m.Id, m.ParentMessageId, m.DeletedAt })
                .FirstOrDefaultAsync(ct);
            if (parent is null) return Result.Failure<MessageDto>(MessageErrors.NotFound);
            if (parent.DeletedAt is not null) return Result.Failure<MessageDto>(MessageErrors.AlreadyDeleted);
            parentId = parent.ParentMessageId ?? parent.Id;
        }

        var message = new Message
        {
            ChannelId = request.ChannelId,
            ParentMessageId = parentId,
            AuthorId = userId,
            BodyMd = body,
        };
        db.Messages.Add(message);

        // Bump LastActivityAt so the sidebar surfaces the channel and
        // unread badges fire for the other members. (LastReadAt is
        // updated separately by the F2-16 MarkRead endpoint.)
        var channelRow = await db.Channels
            .FirstAsync(c => c.Id == request.ChannelId, ct);
        channelRow.LastActivityAt = message.CreatedAt;

        await db.SaveChangesAsync(ct);

        var dto = await MessageProjection.LoadOneAsync(db, message.Id, ct);

        await events.PublishToChannelAsync(
            request.ChannelId, ChannelEvents.MessagePosted, dto, ct);

        return Result.Success(dto!);
    }
}
