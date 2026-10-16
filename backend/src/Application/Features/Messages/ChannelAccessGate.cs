using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Messages;

/// <summary>
/// Shared access check for the F2-18 chat endpoints. Returns the
/// channel's <c>OrganizationId</c> + <c>ArchivedAt</c> so callers can
/// apply per-action rules (e.g. posting requires the channel to be
/// open, reading does not).
/// </summary>
internal static class ChannelAccessGate
{
    public record ChannelContext(Guid ChannelId, Guid OrganizationId, ChannelType Type, DateTime? ArchivedAt);

    public static async Task<Result<ChannelContext>> ResolveAsync(
        IAppDbContext db, Guid channelId, Guid userId, CancellationToken ct)
    {
        var channel = await db.Channels
            .Where(c => c.Id == channelId)
            .Select(c => new ChannelContext(c.Id, c.OrganizationId, c.Type, c.ArchivedAt))
            .FirstOrDefaultAsync(ct);
        if (channel is null)
            return Result.Failure<ChannelContext>(ChannelErrors.NotFound);

        // H2 - every channel type requires an active org membership, so a
        // member removed from the org loses chat access even if a stale
        // ChannelMember row survived. OrgWide is then readable by every
        // org member; everything else also needs an explicit ChannelMember
        // row. Same gate the F2-16 GetChannel query applies.
        var isOrgMember = await db.OrgMemberships.AnyAsync(
            m => m.OrganizationId == channel.OrganizationId
              && m.UserId == userId
              && m.RemovedAt == null, ct);
        if (!isOrgMember)
            return Result.Failure<ChannelContext>(ChannelErrors.NotAMember);

        if (channel.Type != ChannelType.OrgWide)
        {
            var isMember = await db.ChannelMembers
                .AnyAsync(m => m.ChannelId == channel.ChannelId && m.UserId == userId, ct);
            if (!isMember)
                return Result.Failure<ChannelContext>(ChannelErrors.NotAMember);
        }

        return Result.Success(channel);
    }
}
