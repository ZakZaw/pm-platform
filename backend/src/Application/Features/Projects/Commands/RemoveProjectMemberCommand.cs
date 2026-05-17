using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Commands;

public record RemoveProjectMemberCommand(Guid ProjectId, Guid UserId)
    : IRequest<Result>;

public class RemoveProjectMemberCommandHandler(IAppDbContext db)
    : IRequestHandler<RemoveProjectMemberCommand, Result>
{
    public async Task<Result> Handle(RemoveProjectMemberCommand request, CancellationToken ct)
    {
        var membership = await db.ProjectMemberships
            .FirstOrDefaultAsync(m => m.ProjectId == request.ProjectId
                                       && m.UserId == request.UserId, ct);
        if (membership is null)
            return Result.Failure(ProjectErrors.MemberNotFound);

        if (membership.Role == ProjectRole.PM)
        {
            var otherPMs = await db.ProjectMemberships
                .CountAsync(m => m.ProjectId == request.ProjectId
                                  && m.UserId != request.UserId
                                  && m.Role == ProjectRole.PM, ct);
            if (otherPMs == 0)
                return Result.Failure(ProjectErrors.LastPM);
        }

        db.ProjectMemberships.Remove(membership);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
