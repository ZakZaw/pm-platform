using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Commands;

/// <summary>
/// Edit an existing message's body. Only the original author can edit,
/// and we stamp <c>EditedAt</c> so the UI can render the "(edited)"
/// affordance. Soft-deleted messages can't be edited.
/// </summary>
public record EditMessageCommand(Guid MessageId, string BodyMd)
    : IRequest<Result<MessageDto>>;

public class EditMessageCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IProjectEventBus events)
    : IRequestHandler<EditMessageCommand, Result<MessageDto>>
{
    public async Task<Result<MessageDto>> Handle(EditMessageCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MessageDto>(AuthErrors.NotAuthenticated);

        var body = (request.BodyMd ?? string.Empty).Trim();
        if (body.Length == 0)
            return Result.Failure<MessageDto>(MessageErrors.EmptyBody);
        if (body.Length > PostMessageCommandHandler.MaxBodyLength)
            return Result.Failure<MessageDto>(MessageErrors.TooLong);

        var message = await db.Messages
            .FirstOrDefaultAsync(m => m.Id == request.MessageId, ct);
        if (message is null)
            return Result.Failure<MessageDto>(MessageErrors.NotFound);
        if (message.DeletedAt is not null)
            return Result.Failure<MessageDto>(MessageErrors.AlreadyDeleted);
        if (message.AuthorId != userId)
            return Result.Failure<MessageDto>(MessageErrors.NotAuthor);

        message.BodyMd = body;
        message.EditedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        var dto = await MessageProjection.LoadOneAsync(db, message.Id, ct);
        await events.PublishToChannelAsync(
            message.ChannelId, ChannelEvents.MessageEdited, dto, ct);

        return Result.Success(dto!);
    }
}
