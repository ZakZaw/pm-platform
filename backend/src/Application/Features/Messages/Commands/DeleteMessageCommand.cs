using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Commands;

/// <summary>
/// Soft-delete a message: stamps <c>DeletedAt</c> so reply counts and
/// the threaded view stay coherent. The wire DTO substitutes a blank
/// body for deleted messages — the client renders a "(deleted)" stub
/// in place.
/// </summary>
public record DeleteMessageCommand(Guid MessageId)
    : IRequest<Result<Guid>>;

public class DeleteMessageCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IProjectEventBus events)
    : IRequestHandler<DeleteMessageCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(DeleteMessageCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<Guid>(AuthErrors.NotAuthenticated);

        var message = await db.Messages
            .FirstOrDefaultAsync(m => m.Id == request.MessageId, ct);
        if (message is null)
            return Result.Failure<Guid>(MessageErrors.NotFound);
        if (message.DeletedAt is not null)
            return Result.Failure<Guid>(MessageErrors.AlreadyDeleted);
        if (message.AuthorId != userId)
            return Result.Failure<Guid>(MessageErrors.NotAuthor);

        message.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await events.PublishToChannelAsync(
            message.ChannelId,
            ChannelEvents.MessageDeleted,
            new { messageId = message.Id, channelId = message.ChannelId, parentMessageId = message.ParentMessageId },
            ct);

        return Result.Success(message.Id);
    }
}
