using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record UpdateMilestoneCommand(
    Guid MilestoneId,
    string? Title,
    DateOnly? Date,
    string? Color,
    Guid? EpicId,
    bool ClearEpic) : IRequest<Result<MilestoneDto>>;

public class UpdateMilestoneCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<UpdateMilestoneCommand, Result<MilestoneDto>>
{
    public async Task<Result<MilestoneDto>> Handle(UpdateMilestoneCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MilestoneDto>(AuthErrors.NotAuthenticated);

        var m = await db.Milestones.FirstOrDefaultAsync(x => x.Id == request.MilestoneId, ct);
        if (m is null) return Result.Failure<MilestoneDto>(MilestoneErrors.NotFound);

        if (request.Title is { } t)
        {
            var trimmed = t.Trim();
            if (trimmed.Length is < 2 or > 200)
                return Result.Failure<MilestoneDto>(MilestoneErrors.InvalidTitle);
            m.Title = trimmed;
        }
        if (request.Date is { } d) m.Date = d;
        if (request.Color is not null) m.Color = request.Color;

        if (request.ClearEpic)
        {
            m.EpicId = null;
        }
        else if (request.EpicId is { } epicId)
        {
            var epicProjectId = await db.Epics
                .Where(e => e.Id == epicId)
                .Select(e => (Guid?)e.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (epicProjectId != m.ProjectId)
                return Result.Failure<MilestoneDto>(MilestoneErrors.EpicNotInProject);
            m.EpicId = epicId;
        }

        var orgId = await db.Projects
            .Where(p => p.Id == m.ProjectId)
            .Select(p => p.OrganizationId)
            .FirstAsync(ct);

        activity.Record(
            orgId: orgId,
            projectId: m.ProjectId,
            actorId: userId,
            verb: ActivityVerb.MilestoneUpdated,
            targetType: "Milestone",
            targetId: m.Id,
            summary: $"updated milestone {m.Title} ({m.Date:yyyy-MM-dd})");

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(m.ProjectId, ProjectEvents.MilestoneUpdated, new
        {
            id = m.Id, title = m.Title, date = m.Date, epicId = m.EpicId, color = m.Color,
        }, ct);

        return Result.Success(new MilestoneDto(
            m.Id, m.ProjectId, m.Title, m.Date, m.Color, m.EpicId, m.CreatedAt));
    }
}
