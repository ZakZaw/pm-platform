using System.Text.RegularExpressions;
using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages.Commands;

/// <summary>
/// Toggle a reaction on a message. Emoji is a shortcode string
/// (<c>":+1:"</c>) — we render emoji client-side from the shortcode
/// vocabulary so the wire payload stays text. Posting the same
/// (message, user, emoji) twice removes the reaction; posting a new
/// triple adds it.
/// </summary>
public record ToggleReactionCommand(Guid MessageId, string Emoji)
    : IRequest<Result<ToggleReactionResult>>;

public record ToggleReactionResult(Guid MessageId, string Emoji, bool Added, MessageDto Message);

public partial class ToggleReactionCommandHandler(
    IAppDbContext db, ICurrentUser currentUser, IProjectEventBus events)
    : IRequestHandler<ToggleReactionCommand, Result<ToggleReactionResult>>
{
    [GeneratedRegex(@"^:[a-z0-9_+\-]{1,40}:$", RegexOptions.Compiled)]
    private static partial Regex ShortcodeRegex();

    public async Task<Result<ToggleReactionResult>> Handle(ToggleReactionCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ToggleReactionResult>(AuthErrors.NotAuthenticated);

        var emoji = (request.Emoji ?? string.Empty).Trim().ToLowerInvariant();
        if (!ShortcodeRegex().IsMatch(emoji))
            return Result.Failure<ToggleReactionResult>(MessageErrors.InvalidEmoji);

        var message = await db.Messages
            .Where(m => m.Id == request.MessageId)
            .Select(m => new { m.Id, m.ChannelId, m.DeletedAt })
            .FirstOrDefaultAsync(ct);
        if (message is null)
            return Result.Failure<ToggleReactionResult>(MessageErrors.NotFound);
        if (message.DeletedAt is not null)
            return Result.Failure<ToggleReactionResult>(MessageErrors.AlreadyDeleted);

        var gate = await ChannelAccessGate.ResolveAsync(db, message.ChannelId, userId, ct);
        if (!gate.IsSuccess)
            return Result.Failure<ToggleReactionResult>(gate.Error!);

        var existing = await db.MessageReactions
            .FirstOrDefaultAsync(r => r.MessageId == message.Id
                                   && r.UserId == userId
                                   && r.Emoji == emoji, ct);
        bool added;
        if (existing is null)
        {
            db.MessageReactions.Add(new MessageReaction
            {
                MessageId = message.Id,
                UserId = userId,
                Emoji = emoji,
            });
            added = true;
        }
        else
        {
            db.MessageReactions.Remove(existing);
            added = false;
        }
        await db.SaveChangesAsync(ct);

        var dto = await MessageProjection.LoadOneAsync(db, message.Id, ct);
        var result = new ToggleReactionResult(message.Id, emoji, added, dto!);

        await events.PublishToChannelAsync(
            message.ChannelId, ChannelEvents.ReactionToggled, result, ct);

        return Result.Success(result);
    }
}
