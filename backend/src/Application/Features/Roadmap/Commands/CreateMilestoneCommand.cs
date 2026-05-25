using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Roadmap.Commands;

public record CreateMilestoneCommand(
    Guid ProjectId,
    string Title,
    DateOnly Date,
    string? Color,
    Guid? EpicId) : IRequest<Result<MilestoneDto>>;

public record MilestoneDto(
    Guid Id,
    Guid ProjectId,
    string Title,
    DateOnly Date,
    string? Color,
    Guid? EpicId,
    DateTime CreatedAt);

public class CreateMilestoneCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    IActivityRecorder activity,
    IProjectEventBus events)
    : IRequestHandler<CreateMilestoneCommand, Result<MilestoneDto>>
{
    public async Task<Result<MilestoneDto>> Handle(CreateMilestoneCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<MilestoneDto>(AuthErrors.NotAuthenticated);

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length is < 2 or > 200)
            return Result.Failure<MilestoneDto>(MilestoneErrors.InvalidTitle);

        var project = await db.Projects
            .Where(p => p.Id == request.ProjectId)
            .Select(p => new { p.Id, p.OrganizationId })
            .FirstOrDefaultAsync(ct);
        if (project is null) return Result.Failure<MilestoneDto>(ProjectErrors.NotFound);

        if (request.EpicId is { } epicId)
        {
            var epicProjectId = await db.Epics
                .Where(e => e.Id == epicId)
                .Select(e => (Guid?)e.ProjectId)
                .FirstOrDefaultAsync(ct);
            if (epicProjectId != request.ProjectId)
                return Result.Failure<MilestoneDto>(MilestoneErrors.EpicNotInProject);
        }

        var m = new Milestone
        {
            ProjectId = project.Id,
            Title = title,
            Date = request.Date,
            Color = request.Color,
            EpicId = request.EpicId,
            CreatedByUserId = userId,
        };
        db.Milestones.Add(m);

        activity.Record(
            orgId: project.OrganizationId,
            projectId: project.Id,
            actorId: userId,
            verb: ActivityVerb.MilestoneCreated,
            targetType: "Milestone",
            targetId: m.Id,
            summary: $"added milestone {m.Title} ({m.Date:yyyy-MM-dd})");

        await db.SaveChangesAsync(ct);

        await events.PublishAsync(project.Id, ProjectEvents.MilestoneCreated, new
        {
            id = m.Id, title = m.Title, date = m.Date, epicId = m.EpicId, color = m.Color,
        }, ct);

        return Result.Success(new MilestoneDto(
            m.Id, m.ProjectId, m.Title, m.Date, m.Color, m.EpicId, m.CreatedAt));
    }
}
