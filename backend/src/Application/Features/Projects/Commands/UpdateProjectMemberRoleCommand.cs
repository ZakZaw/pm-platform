using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Commands;

public record UpdateProjectMemberRoleCommand(Guid ProjectId, Guid UserId, string Role)
    : IRequest<Result<ProjectMemberDto>>;

public class UpdateProjectMemberRoleCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateProjectMemberRoleCommand, Result<ProjectMemberDto>>
{
    public async Task<Result<ProjectMemberDto>> Handle(
        UpdateProjectMemberRoleCommand request, CancellationToken ct)
    {
        if (!Enum.TryParse<ProjectRole>(request.Role, ignoreCase: true, out var role))
            return Result.Failure<ProjectMemberDto>(ProjectErrors.InvalidProjectRole);

        var membership = await db.ProjectMemberships
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId
                                       && m.UserId == request.UserId, ct);
        if (membership is null)
            return Result.Failure<ProjectMemberDto>(ProjectErrors.MemberNotFound);

        // Demoting the last PM would leave the project without a leader.
        if (membership.Role == ProjectRole.PM && role != ProjectRole.PM)
        {
            var otherPMs = await db.ProjectMemberships
                .CountAsync(m => m.ProjectId == request.ProjectId
                                  && m.UserId != request.UserId
                                  && m.Role == ProjectRole.PM, ct);
            if (otherPMs == 0)
                return Result.Failure<ProjectMemberDto>(ProjectErrors.LastPM);
        }

        membership.Role = role;
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
