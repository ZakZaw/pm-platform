using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record DeleteMilestoneCommand(Guid MilestoneId) : IRequest<Result>;

public class DeleteMilestoneCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<DeleteMilestoneCommand, Result>
{
    public async Task<Result> Handle(DeleteMilestoneCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var m = await db.Milestones.FirstOrDefaultAsync(x => x.Id == request.MilestoneId, ct);
        if (m is null) return Result.Failure(MilestoneErrors.NotFound);

        var orgId = await db.Projects
            .Where(p => p.Id == m.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);
        var projectId = m.ProjectId;
        var milestoneId = m.Id;
        var title = m.Title;

        db.Milestones.Remove(m);
        activity.Record(
            orgId: orgId,
            projectId: projectId,
            actorId: userId,
            verb: ActivityVerb.MilestoneDeleted,
            targetType: "Milestone",
            targetId: milestoneId,
            summary: $"removed milestone {title}");
        await db.SaveChangesAsync(ct);

        await events.PublishAsync(projectId, ProjectEvents.MilestoneDeleted, new { id = milestoneId }, ct);
        return Result.Success();
    }
}
