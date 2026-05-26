using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Projects.Commands;

/// <summary>
/// PM-only mutator for project-scoped settings. Right now this is just the
/// AI control mode (F2-08) — future settings (default sprint length,
/// timezone, etc.) layer in here without minting a new command per field.
/// Every mode change goes through <see cref="AIAuditLog"/> so the rollback
/// path stays traceable.
/// </summary>
public record UpdateProjectSettingsCommand(
    Guid ProjectId,
    string? AIControlMode) : IRequest<Result<ProjectDto>>;

public class UpdateProjectSettingsCommandHandler(
    IAppDbContext db,
    ICurrentUser currentUser)
    : IRequestHandler<UpdateProjectSettingsCommand, Result<ProjectDto>>
{
    public async Task<Result<ProjectDto>> Handle(
        UpdateProjectSettingsCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<ProjectDto>(AuthErrors.NotAuthenticated);

        var project = await db.Projects
            .Include(p => p.Organization)
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct);
        if (project is null) return Result.Failure<ProjectDto>(ProjectErrors.NotFound);

        var changed = false;

        if (request.AIControlMode is not null)
        {
            if (!Enum.TryParse<AIControlMode>(request.AIControlMode, ignoreCase: true, out var mode))
                return Result.Failure<ProjectDto>(ProjectErrors.InvalidAIControlMode);

            if (project.AIControlMode != mode)
            {
                var before = project.AIControlMode;
                project.AIControlMode = mode;

                db.AIAuditLogs.Add(new AIAuditLog
                {
                    ActionType = "project.ai_control_mode_changed",
                    UserId = userId,
                    ProjectId = project.Id,
                    // Mode flip carries no LLM prompt — record the transition
                    // shape so the audit row is self-describing without one.
                    Prompt = $$"""{ "from": "{{before}}", "to": "{{mode}}" }""",
                    BeforeStateJson = $$"""{ "mode": "{{before}}" }""",
                    AfterStateJson = $$"""{ "mode": "{{mode}}" }""",
                    Applied = true,
                    AppliedAt = DateTime.UtcNow,
                    Provider = "n/a",
                    Model = "n/a",
                });
                changed = true;
            }
        }

        if (changed) await db.SaveChangesAsync(ct);

        var role = await db.ProjectMemberships
            .Where(m => m.ProjectId == project.Id && m.UserId == userId)
            .Select(m => (ProjectRole?)m.Role)
            .FirstOrDefaultAsync(ct);

        return Result.Success(new ProjectDto(
            project.Id,
            project.IsPersonal ? null : project.OrganizationId,
            project.IsPersonal ? null : project.Organization?.Slug,
            project.Name,
            project.Slug,
            project.Key,
            project.Type.ToString(),
            project.Status.ToString(),
            project.TargetDate,
            project.AIControlMode.ToString(),
            project.CreatedBy,
            project.CreatedAt,
            project.IsPersonal,
            role?.ToString()));
    }
}
