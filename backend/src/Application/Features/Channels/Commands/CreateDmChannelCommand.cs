using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// F2-17 — create (or look up) a direct-message channel between the
/// caller and one-to-seven other members of the same org. The caller
/// is implicit and always added. We dedupe: if an unarchived DM
/// already has the exact same membership set, we return that one
/// instead of creating a duplicate. Cross-project conversations are
/// allowed — DMs only depend on org membership, not on shared
/// projects.
/// </summary>
public record CreateDmChannelCommand(
    string OrgSlug,
    IReadOnlyList<Guid> MemberIds) : IRequest<Result<ChannelDetailDto>>;

public class CreateDmChannelCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateDmChannelCommand, Result<ChannelDetailDto>>
{
    /// <summary>
    /// Max members in a DM. Includes the caller — so a request can
    /// name up to 7 others. Matches the F2-17 roadmap cap.
    /// </summary>
    public const int MaxMembers = 8;

    public async Task<Result<ChannelDetailDto>> Handle(
        CreateDmChannelCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } callerId)
            return Result.Failure<ChannelDetailDto>(AuthErrors.NotAuthenticated);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<ChannelDetailDto>(OrgErrors.NotFound);

        var callerIsOrgMember = await db.OrgMemberships.AnyAsync(
            m => m.OrganizationId == org.Id
              && m.UserId == callerId
              && m.RemovedAt == null, ct);
        if (!callerIsOrgMember)
            return Result.Failure<ChannelDetailDto>(OrgErrors.NotFound);

        // Normalise the requested member set: drop dupes, drop the
        // caller (we always add them), keep insertion order so the
        // generated name reads sensibly.
        var others = new List<Guid>();
        var seen = new HashSet<Guid> { callerId };
        foreach (var id in request.MemberIds ?? [])
        {
            if (id == Guid.Empty) continue;
            if (!seen.Add(id)) continue;
            others.Add(id);
        }
        if (others.Count == 0)
            return Result.Failure<ChannelDetailDto>(ChannelErrors.DmMembersRequired);
        if (others.Count + 1 > MaxMembers)
            return Result.Failure<ChannelDetailDto>(ChannelErrors.DmTooManyMembers);

        // Every named user must be an active org member. We pull names
        // up front so the channel can be named (e.g. "Aria, Theo, Maya").
        var users = await db.Users
            .Where(u => others.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName, u.Email })
            .ToListAsync(ct);
        if (users.Count != others.Count)
            return Result.Failure<ChannelDetailDto>(OrgErrors.MemberNotFound);

        var activeMemberIds = await db.OrgMemberships
            .Where(m => m.OrganizationId == org.Id
                     && others.Contains(m.UserId)
                     && m.RemovedAt == null)
            .Select(m => m.UserId)
            .ToListAsync(ct);
        if (activeMemberIds.Count != others.Count)
            return Result.Failure<ChannelDetailDto>(OrgErrors.MemberNotFound);

        var fullSet = new HashSet<Guid>(others) { callerId };

        // Dedup: find any unarchived DM in this org whose member set is
        // exactly fullSet. We pull candidate DMs the caller is on, then
        // compare membership in memory — small N (≤8 each) so the cost
        // is negligible.
        var candidateDmIds = await db.ChannelMembers
            .Where(m => m.UserId == callerId
                     && m.Channel.OrganizationId == org.Id
                     && m.Channel.Type == ChannelType.Dm
                     && m.Channel.ArchivedAt == null)
            .Select(m => m.ChannelId)
            .ToListAsync(ct);

        if (candidateDmIds.Count > 0)
        {
            var memberRows = await db.ChannelMembers
                .Where(m => candidateDmIds.Contains(m.ChannelId))
                .Select(m => new { m.ChannelId, m.UserId })
                .ToListAsync(ct);
            var membersByChannel = memberRows
                .GroupBy(r => r.ChannelId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.UserId).ToHashSet());
            var match = membersByChannel.FirstOrDefault(p =>
                p.Value.Count == fullSet.Count && p.Value.SetEquals(fullSet));
            if (match.Key != Guid.Empty)
            {
                return await BuildDetailAsync(match.Key, ct);
            }
        }

        // Order names so the auto-generated channel name reads in the
        // order the caller picked them. We don't include the caller in
        // the label — every viewer sees the other members.
        var ordered = others
            .Select(id => users.First(u => u.Id == id))
            .ToList();
        var displayName = BuildName(ordered.Select(u => u.FullName ?? u.Email).ToList());

        var channel = new Channel
        {
            OrganizationId = org.Id,
            Name = displayName,
            Type = ChannelType.Dm,
            CreatedByUserId = callerId,
        };
        db.Channels.Add(channel);

        db.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = callerId,
        });
        foreach (var memberId in others)
        {
            db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = channel.Id,
                UserId = memberId,
            });
        }

        await db.SaveChangesAsync(ct);

        return await BuildDetailAsync(channel.Id, ct);
    }

    /// <summary>
    /// Builds a human-readable channel name from the other members'
    /// display names. Three or fewer → comma-joined; more → first
    /// two plus "+ N more" so the sidebar row stays short.
    /// </summary>
    private static string BuildName(IReadOnlyList<string> names)
    {
        if (names.Count == 0) return "Direct message";
        if (names.Count <= 3) return string.Join(", ", names);
        return $"{names[0]}, {names[1]} + {names.Count - 2} more";
    }

    private async Task<Result<ChannelDetailDto>> BuildDetailAsync(Guid channelId, CancellationToken ct)
    {
        var channel = await db.Channels
            .Where(c => c.Id == channelId)
            .Select(c => new
            {
                c.Id, c.OrganizationId, c.Name, c.Type,
                c.LastActivityAt, c.CreatedAt, c.ArchivedAt,
            })
            .FirstAsync(ct);
        var members = await db.ChannelMembers
            .Where(m => m.ChannelId == channelId)
            .OrderBy(m => m.User.FullName)
            .Select(m => new ChannelMemberDto(
                m.UserId, m.User.FullName, m.User.Email, m.User.AvatarUrl,
                m.JoinedAt, m.LastReadAt))
            .ToListAsync(ct);

        return Result.Success(new ChannelDetailDto(
            channel.Id, channel.OrganizationId, channel.Name, channel.Type.ToString(),
            ProjectId: null, ProjectName: null, ProjectSlug: null,
            TeamId: null, EpicId: null, EpicTitle: null,
            channel.LastActivityAt, channel.CreatedAt, channel.ArchivedAt,
            members));
    }
}
