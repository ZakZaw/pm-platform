using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Workflow.Commands;

/// <summary>
/// Adds a new column to the project's workflow. Each new column maps to one
/// of the canonical <see cref="DomainTaskStatus"/> values (the state machine
/// is enforced at that level); the column's display name + colour + order
/// are free.
/// </summary>
public record CreateStatusConfigCommand(
    Guid ProjectId,
    string BaseStatus,
    string DisplayName,
    string? Color,
    bool IsDoneState) : IRequest<Result<StatusConfigDto>>;

public class CreateStatusConfigCommandHandler(IAppDbContext db)
    : IRequestHandler<CreateStatusConfigCommand, Result<StatusConfigDto>>
{
    private static readonly HashSet<string> AllowedColors = new(StringComparer.OrdinalIgnoreCase)
    {
        "neutral", "info", "purple", "warning", "danger", "success",
    };

    public async Task<Result<StatusConfigDto>> Handle(
        CreateStatusConfigCommand request, CancellationToken ct)
    {
        if (!Enum.TryParse<DomainTaskStatus>(request.BaseStatus, ignoreCase: true, out var status))
            return Result.Failure<StatusConfigDto>(TaskErrors.InvalidStatus);

        var name = (request.DisplayName ?? string.Empty).Trim();
        if (name.Length is < 1 or > 60)
            return Result.Failure<StatusConfigDto>(WorkflowErrors.InvalidDisplayName);

        var color = (request.Color ?? "neutral").Trim().ToLowerInvariant();
        if (!AllowedColors.Contains(color))
            return Result.Failure<StatusConfigDto>(WorkflowErrors.InvalidColor);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<StatusConfigDto>(ProjectErrors.NotFound);

        var nextOrder = 1 + (await db.ProjectStatusConfigs
            .Where(c => c.ProjectId == request.ProjectId)
            .Select(c => (int?)c.OrderIndex)
            .MaxAsync(ct) ?? -1);

        var config = new ProjectStatusConfig
        {
            ProjectId = request.ProjectId,
            Status = status,
            DisplayName = name,
            Color = color,
            OrderIndex = nextOrder,
            IsDoneState = request.IsDoneState,
            IsVisible = true,
        };
        db.ProjectStatusConfigs.Add(config);
        await db.SaveChangesAsync(ct);

        return Result.Success(new StatusConfigDto(
            config.Id, config.ProjectId, config.Status.ToString(), config.DisplayName,
            config.Color, config.OrderIndex, config.IsDoneState, config.IsVisible));
    }
}
