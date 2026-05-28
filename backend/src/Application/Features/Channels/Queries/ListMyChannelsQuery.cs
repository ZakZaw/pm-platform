using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Queries;

/// <summary>
/// Sidebar query: every channel in this org the current user can read.
/// That's (a) the OrgWide channel (every active org member sees it,
/// even before joining) and (b) every channel where they have a
/// ChannelMember row. Archived channels are filtered unless the caller
/// asks for them explicitly.
/// </summary>
public record ListMyChannelsQuery(string OrgSlug, bool IncludeArchived = false)
    : IRequest<Result<IReadOnlyList<ChannelListItemDto>>>;

public class ListMyChannelsQueryHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<ListMyChannelsQuery, Result<IReadOnlyList<ChannelListItemDto>>>
{
    public async Task<Result<IReadOnlyList<ChannelListItemDto>>> Handle(
        ListMyChannelsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<IReadOnlyList<ChannelListItemDto>>(AuthErrors.NotAuthenticated);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<IReadOnlyList<ChannelListItemDto>>(OrgErrors.NotFound);

        var isOrgMember = await db.OrgMemberships.AnyAsync(
            m => m.OrganizationId == org.Id
              && m.UserId == userId
              && m.RemovedAt == null, ct);
        if (!isOrgMember)
            return Result.Failure<IReadOnlyList<ChannelListItemDto>>(OrgErrors.NotFound);

        // Channel ids the user can read: ones they belong to + the
        // org-wide channel which everybody can read regardless.
        var memberRows = await db.ChannelMembers
            .Where(m => m.UserId == userId && m.Channel.OrganizationId == org.Id)
            .Select(m => new { m.ChannelId, m.LastReadAt })
            .ToListAsync(ct);
        var lastReadByChannel = memberRows.ToDictionary(r => r.ChannelId, r => r.LastReadAt);
        var memberIds = memberRows.Select(r => r.ChannelId).ToHashSet();

        var query = db.Channels
            .Where(c => c.OrganizationId == org.Id
                     && (memberIds.Contains(c.Id) || c.Type == Domain.Enums.ChannelType.OrgWide));
        if (!request.IncludeArchived)
            query = query.Where(c => c.ArchivedAt == null);

        var rows = await query
            .OrderBy(c => c.Type)
            .ThenBy(c => c.Name)
            .Select(c => new
            {
                c.Id, c.Name, c.Type, c.ProjectId, c.TeamId, c.EpicId,
                c.LastActivityAt, c.ArchivedAt,
                ProjectName = c.Project != null ? c.Project.Name : null,
                ProjectKey = c.Project != null ? c.Project.Key : null,
                EpicTitle = c.Epic != null ? c.Epic.Title : null,
            })
            .ToListAsync(ct);

        // F2-18 unread counts: count top-level messages posted after
        // the caller's LastReadAt (or all of them if they've never
        // opened the channel). One round-trip — group by channel and
        // hydrate a dict.
        var channelIds = rows.Select(r => r.Id).ToList();
        var unreadRows = await db.Messages
            .Where(m => channelIds.Contains(m.ChannelId)
                     && m.ParentMessageId == null
                     && m.DeletedAt == null
                     && m.AuthorId != userId)
            .Select(m => new { m.ChannelId, m.CreatedAt })
            .ToListAsync(ct);
        var unreadByChannel = unreadRows
            .GroupBy(m => m.ChannelId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    lastReadByChannel.TryGetValue(g.Key, out var lastRead);
                    return lastRead is null
                        ? g.Count()
                        : g.Count(m => m.CreatedAt > lastRead.Value);
                });

        var items = rows.Select(r =>
        {
            lastReadByChannel.TryGetValue(r.Id, out var lastRead);
            unreadByChannel.TryGetValue(r.Id, out var unread);
            return new ChannelListItemDto(
                r.Id, r.Name, r.Type.ToString(),
                r.ProjectId, r.ProjectName, r.ProjectKey,
                r.TeamId, r.EpicId, r.EpicTitle,
                r.LastActivityAt, lastRead, r.ArchivedAt,
                unread);
        }).ToList();

        return Result.Success<IReadOnlyList<ChannelListItemDto>>(items);
    }
}
