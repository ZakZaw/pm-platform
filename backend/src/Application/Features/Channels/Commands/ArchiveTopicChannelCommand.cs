using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// Manually archives a Topic channel. Project/Team/OrgWide channels
/// follow their owning entity's lifecycle and can't be archived from
/// here.
/// </summary>
public record ArchiveTopicChannelCommand(Guid ChannelId) : IRequest<Result>;

public class ArchiveTopicChannelCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ArchiveTopicChannelCommand, Result>
{
    public async Task<Result> Handle(ArchiveTopicChannelCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var channel = await db.Channels
            .FirstOrDefaultAsync(c => c.Id == request.ChannelId, ct);
        if (channel is null)
            return Result.Failure(ChannelErrors.NotFound);

        if (channel.Type != ChannelType.Topic)
            return Result.Failure(ChannelErrors.CannotArchiveSystem);

        if (channel.ArchivedAt is not null)
            return Result.Success(); // idempotent

        // Caller must be either a member of the channel or the
        // channel's creator. Stricter rules can layer on later.
        var canActOnChannel = channel.CreatedByUserId == userId
            || await db.ChannelMembers
                .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == userId, ct);
        if (!canActOnChannel)
            return Result.Failure(ChannelErrors.NotAMember);

        channel.ArchivedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
