using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Commands;

/// <summary>
/// Adds a user to a project. The user must already be an active member of
/// the project's organisation — projects don't accept arbitrary users.
/// </summary>
public record AddProjectMemberCommand(
    Guid ProjectId,
    Guid UserId,
    string? Role) : IRequest<Result<ProjectMemberDto>>;

public class AddProjectMemberCommandHandler(IAppDbContext db)
    : IRequestHandler<AddProjectMemberCommand, Result<ProjectMemberDto>>
{
    public async Task<Result<ProjectMemberDto>> Handle(
        AddProjectMemberCommand request, CancellationToken ct)
    {
        var project = await db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct);
        if (project is null)
            return Result.Failure<ProjectMemberDto>(ProjectErrors.NotFound);
        if (project.IsPersonal || project.OrganizationId is null)
            return Result.Failure<ProjectMemberDto>(ProjectErrors.NotFound);

        var orgMember = await db.OrgMemberships
            .Where(m => m.OrganizationId == project.OrganizationId
                         && m.UserId == request.UserId
                         && m.RemovedAt == null)
            .Select(m => new { m.UserId })
            .FirstOrDefaultAsync(ct);
        if (orgMember is null)
            return Result.Failure<ProjectMemberDto>(ProjectErrors.NotOrgMember);

        var existing = await db.ProjectMemberships
            .AnyAsync(m => m.ProjectId == project.Id && m.UserId == request.UserId, ct);
        if (existing)
            return Result.Failure<ProjectMemberDto>(ProjectErrors.AlreadyMember);

        var role = ProjectRole.Contributor;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            if (!Enum.TryParse(request.Role, ignoreCase: true, out role))
                return Result.Failure<ProjectMemberDto>(ProjectErrors.InvalidProjectRole);
        }

        var membership = new ProjectMembership
        {
            ProjectId = project.Id,
            UserId = request.UserId,
            Role = role,
        };
        db.ProjectMemberships.Add(membership);

        // F2-16 — keep the project's channel membership in lock-step.
        // Old projects without a channel just skip; the next channel
        // controller call will materialise one if needed.
        var channelId = await db.Channels
            .Where(c => c.ProjectId == project.Id
                     && c.Type == ChannelType.Project
                     && c.ArchivedAt == null)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(ct);
        if (channelId is { } cid)
        {
            var alreadyChannelMember = await db.ChannelMembers
                .AnyAsync(m => m.ChannelId == cid && m.UserId == request.UserId, ct);
            if (!alreadyChannelMember)
            {
                db.ChannelMembers.Add(new ChannelMember
                {
                    ChannelId = cid,
                    UserId = request.UserId,
                });
            }
        }

        await db.SaveChangesAsync(ct);

        var user = await db.Users
            .Where(u => u.Id == request.UserId)
            .Select(u => new { u.Email, u.FullName, u.AvatarUrl })
            .FirstAsync(ct);

        return Result.Success(new ProjectMemberDto(
            request.UserId, user.Email, user.FullName, user.AvatarUrl,
            role.ToString(), membership.JoinedAt));
    }
}
