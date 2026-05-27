using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// Stamps the caller's <c>ChannelMember.LastReadAt</c> to now. For the
/// OrgWide channel we lazy-create the membership row on first read so
/// every org member can keep an unread state without an explicit join.
/// </summary>
public record MarkChannelReadCommand(Guid ChannelId) : IRequest<Result>;

public class MarkChannelReadCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<MarkChannelReadCommand, Result>
{
    public async Task<Result> Handle(MarkChannelReadCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var channel = await db.Channels
            .Where(c => c.Id == request.ChannelId)
            .Select(c => new { c.Id, c.OrganizationId, c.Type })
            .FirstOrDefaultAsync(ct);
        if (channel is null)
            return Result.Failure(ChannelErrors.NotFound);

        var member = await db.ChannelMembers
            .FirstOrDefaultAsync(m => m.ChannelId == channel.Id && m.UserId == userId, ct);

        if (member is null)
        {
            // OrgWide auto-joins on first read so the unread badge has
            // a place to live; everything else requires explicit
            // membership.
            if (channel.Type != Domain.Enums.ChannelType.OrgWide)
                return Result.Failure(ChannelErrors.NotAMember);

            var isOrgMember = await db.OrgMemberships.AnyAsync(
                m => m.OrganizationId == channel.OrganizationId
                  && m.UserId == userId
                  && m.RemovedAt == null, ct);
            if (!isOrgMember)
                return Result.Failure(ChannelErrors.NotAMember);

            member = new Domain.Entities.ChannelMember
            {
                ChannelId = channel.Id,
                UserId = userId,
                LastReadAt = DateTime.UtcNow,
            };
            db.ChannelMembers.Add(member);
        }
        else
        {
            member.LastReadAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
