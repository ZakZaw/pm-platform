using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Queries;

public record ListProjectMembersQuery(Guid ProjectId)
    : IRequest<Result<IReadOnlyList<ProjectMemberDto>>>;

public class ListProjectMembersQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectMembersQuery, Result<IReadOnlyList<ProjectMemberDto>>>
{
    public async Task<Result<IReadOnlyList<ProjectMemberDto>>> Handle(
        ListProjectMembersQuery request, CancellationToken ct)
    {
        var members = await db.ProjectMemberships
            .Where(m => m.ProjectId == request.ProjectId)
            .OrderBy(m => m.JoinedAt)
            .Select(m => new ProjectMemberDto(
                m.UserId,
                m.User.Email,
                m.User.FullName,
                m.User.AvatarUrl,
                m.Role.ToString(),
                m.JoinedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ProjectMemberDto>>(members);
    }
}
