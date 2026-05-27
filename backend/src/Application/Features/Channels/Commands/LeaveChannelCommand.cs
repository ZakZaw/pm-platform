using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// Remove a user from a Topic channel. Self-leave is always allowed;
/// other removals require the caller to be a current member (a thin
/// gate — F2-16 doesn't try to enforce ownership). Project / Team /
/// OrgWide channels reject leave attempts to keep their membership
/// tied to the owning entity.
/// </summary>
public record LeaveChannelCommand(Guid ChannelId, Guid UserId) : IRequest<Result>;

public class LeaveChannelCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<LeaveChannelCommand, Result>
{
    public async Task<Result> Handle(LeaveChannelCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } callerId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var channel = await db.Channels
            .Where(c => c.Id == request.ChannelId)
            .Select(c => new { c.Id, c.Type })
            .FirstOrDefaultAsync(ct);
        if (channel is null)
            return Result.Failure(ChannelErrors.NotFound);

        if (channel.Type != ChannelType.Topic)
            return Result.Failure(ChannelErrors.InvalidScope);

        if (request.UserId != callerId)
        {
            var callerIsMember = await db.ChannelMembers
                .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == callerId, ct);
            if (!callerIsMember)
                return Result.Failure(ChannelErrors.NotAMember);
        }

        var member = await db.ChannelMembers
            .FirstOrDefaultAsync(m => m.ChannelId == channel.Id
                                   && m.UserId == request.UserId, ct);
        if (member is null) return Result.Success(); // idempotent

        db.ChannelMembers.Remove(member);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
