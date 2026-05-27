using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// Creates an ad-hoc Topic channel scoped to an org. Optionally pinned
/// to an epic — that drives the "linked epic" badge in the AC. The
/// creator is automatically added as the first ChannelMember.
/// </summary>
public record CreateTopicChannelCommand(
    string OrgSlug,
    string Name,
    Guid? EpicId,
    IReadOnlyList<Guid>? InitialMemberIds) : IRequest<Result<ChannelDetailDto>>;

public class CreateTopicChannelCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateTopicChannelCommand, Result<ChannelDetailDto>>
{
    public async Task<Result<ChannelDetailDto>> Handle(
        CreateTopicChannelCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ChannelDetailDto>(AuthErrors.NotAuthenticated);

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 2 or > 120)
            return Result.Failure<ChannelDetailDto>(ChannelErrors.InvalidName);

        var org = await db.Organizations
            .Where(o => o.Slug == request.OrgSlug)
            .Select(o => new { o.Id })
            .FirstOrDefaultAsync(ct);
        if (org is null)
            return Result.Failure<ChannelDetailDto>(OrgErrors.NotFound);

        // Caller must be an active org member.
        var isOrgMember = await db.OrgMemberships.AnyAsync(
            m => m.OrganizationId == org.Id
              && m.UserId == userId
              && m.RemovedAt == null, ct);
        if (!isOrgMember)
            return Result.Failure<ChannelDetailDto>(OrgErrors.NotFound);

        // Linked-epic validation: pinned epic must belong to a project
        // in this org.
        if (request.EpicId is { } epicId)
        {
            var epicOrgId = await db.Epics
                .Where(e => e.Id == epicId)
                .Select(e => (Guid?)e.Project.OrganizationId)
                .FirstOrDefaultAsync(ct);
            if (epicOrgId != org.Id)
                return Result.Failure<ChannelDetailDto>(ChannelErrors.EpicNotInOrg);
        }

        var channel = new Channel
        {
            OrganizationId = org.Id,
            Name = name,
            Type = ChannelType.Topic,
            EpicId = request.EpicId,
            CreatedByUserId = userId,
        };
        db.Channels.Add(channel);

        var seenMembers = new HashSet<Guid> { userId };
        db.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = userId,
        });

        foreach (var memberId in request.InitialMemberIds ?? [])
        {
            if (!seenMembers.Add(memberId)) continue;
            // Only add users who are active in the same org.
            var isMember = await db.OrgMemberships.AnyAsync(
                m => m.OrganizationId == org.Id
                  && m.UserId == memberId
                  && m.RemovedAt == null, ct);
            if (!isMember) continue;
            db.ChannelMembers.Add(new ChannelMember
            {
                ChannelId = channel.Id,
                UserId = memberId,
            });
        }

        await db.SaveChangesAsync(ct);

        var members = await db.ChannelMembers
            .Where(m => m.ChannelId == channel.Id)
            .OrderBy(m => m.User.FullName)
            .Select(m => new ChannelMemberDto(
                m.UserId, m.User.FullName, m.User.Email, m.User.AvatarUrl,
                m.JoinedAt, m.LastReadAt))
            .ToListAsync(ct);

        string? epicTitle = null;
        if (channel.EpicId is { } id)
        {
            epicTitle = await db.Epics
                .Where(e => e.Id == id)
                .Select(e => e.Title)
                .FirstOrDefaultAsync(ct);
        }

        return Result.Success(new ChannelDetailDto(
            channel.Id, channel.OrganizationId, channel.Name, channel.Type.ToString(),
            ProjectId: null, ProjectName: null, ProjectSlug: null,
            TeamId: null, channel.EpicId, epicTitle,
            channel.LastActivityAt, channel.CreatedAt, channel.ArchivedAt,
            members));
    }
}
