using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Queries;

public record GetChannelQuery(Guid ChannelId) : IRequest<Result<ChannelDetailDto>>;

public class GetChannelQueryHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetChannelQuery, Result<ChannelDetailDto>>
{
    public async Task<Result<ChannelDetailDto>> Handle(GetChannelQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ChannelDetailDto>(AuthErrors.NotAuthenticated);

        var channel = await db.Channels
            .Where(c => c.Id == request.ChannelId)
            .Select(c => new
            {
                c.Id, c.OrganizationId, c.Name, c.Type,
                c.ProjectId, c.TeamId, c.EpicId,
                c.LastActivityAt, c.CreatedAt, c.ArchivedAt,
                ProjectName = c.Project != null ? c.Project.Name : null,
                ProjectSlug = c.Project != null ? c.Project.Slug : null,
                EpicTitle = c.Epic != null ? c.Epic.Title : null,
            })
            .FirstOrDefaultAsync(ct);
        if (channel is null)
            return Result.Failure<ChannelDetailDto>(ChannelErrors.NotFound);

        // Access gate: OrgWide is readable by every active org member;
        // everything else requires an explicit ChannelMember row.
        if (channel.Type == Domain.Enums.ChannelType.OrgWide)
        {
            var isOrgMember = await db.OrgMemberships.AnyAsync(
                m => m.OrganizationId == channel.OrganizationId
                  && m.UserId == userId
                  && m.RemovedAt == null, ct);
            if (!isOrgMember)
                return Result.Failure<ChannelDetailDto>(ChannelErrors.NotAMember);
        }
        else
        {
            var isMember = await db.ChannelMembers
                .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == userId, ct);
            if (!isMember)
                return Result.Failure<ChannelDetailDto>(ChannelErrors.NotAMember);
        }

        var members = await db.ChannelMembers
            .Where(m => m.ChannelId == channel.Id)
            .OrderBy(m => m.User.FullName)
            .Select(m => new ChannelMemberDto(
                m.UserId, m.User.FullName, m.User.Email, m.User.AvatarUrl,
                m.JoinedAt, m.LastReadAt))
            .ToListAsync(ct);

        return Result.Success(new ChannelDetailDto(
            channel.Id, channel.OrganizationId, channel.Name, channel.Type.ToString(),
            channel.ProjectId, channel.ProjectName, channel.ProjectSlug,
            channel.TeamId, channel.EpicId, channel.EpicTitle,
            channel.LastActivityAt, channel.CreatedAt, channel.ArchivedAt,
            members));
    }
}
