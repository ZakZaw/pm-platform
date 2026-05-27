using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Channels.Commands;

/// <summary>
/// Add a user to a channel's membership list. Only valid for Topic
/// channels — Project/Team channels sync with their owning
/// membership table, and OrgWide auto-joins on first read.
/// </summary>
public record AddChannelMemberCommand(Guid ChannelId, Guid UserId)
    : IRequest<Result<ChannelMemberDto>>;

public class AddChannelMemberCommandHandler(
    IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<AddChannelMemberCommand, Result<ChannelMemberDto>>
{
    public async Task<Result<ChannelMemberDto>> Handle(
        AddChannelMemberCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } callerId)
            return Result.Failure<ChannelMemberDto>(AuthErrors.NotAuthenticated);

        var channel = await db.Channels
            .Where(c => c.Id == request.ChannelId)
            .Select(c => new { c.Id, c.OrganizationId, c.Type, c.ArchivedAt })
            .FirstOrDefaultAsync(ct);
        if (channel is null)
            return Result.Failure<ChannelMemberDto>(ChannelErrors.NotFound);
        if (channel.ArchivedAt is not null)
            return Result.Failure<ChannelMemberDto>(ChannelErrors.Archived);
        if (channel.Type != ChannelType.Topic)
            return Result.Failure<ChannelMemberDto>(ChannelErrors.InvalidScope);

        var callerIsMember = await db.ChannelMembers
            .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == callerId, ct);
        if (!callerIsMember)
            return Result.Failure<ChannelMemberDto>(ChannelErrors.NotAMember);

        var targetIsOrgMember = await db.OrgMemberships.AnyAsync(
            m => m.OrganizationId == channel.OrganizationId
              && m.UserId == request.UserId
              && m.RemovedAt == null, ct);
        if (!targetIsOrgMember)
            return Result.Failure<ChannelMemberDto>(OrgErrors.MemberNotFound);

        var existing = await db.ChannelMembers
            .AnyAsync(m => m.ChannelId == channel.Id && m.UserId == request.UserId, ct);
        if (existing)
        {
            var existingRow = await db.ChannelMembers
                .Where(m => m.ChannelId == channel.Id && m.UserId == request.UserId)
                .Select(m => new ChannelMemberDto(
                    m.UserId, m.User.FullName, m.User.Email, m.User.AvatarUrl,
                    m.JoinedAt, m.LastReadAt))
                .FirstAsync(ct);
            return Result.Success(existingRow);
        }

        var member = new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = request.UserId,
        };
        db.ChannelMembers.Add(member);
        await db.SaveChangesAsync(ct);

        var user = await db.Users
            .Where(u => u.Id == request.UserId)
            .Select(u => new { u.FullName, u.Email, u.AvatarUrl })
            .FirstAsync(ct);

        return Result.Success(new ChannelMemberDto(
            request.UserId, user.FullName, user.Email, user.AvatarUrl,
            member.JoinedAt, member.LastReadAt));
    }
}
