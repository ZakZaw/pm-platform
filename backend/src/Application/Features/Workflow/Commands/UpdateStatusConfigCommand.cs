using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Workflow.Commands;

public record UpdateStatusConfigCommand(
    Guid ProjectId,
    Guid ConfigId,
    string? DisplayName,
    string? Color,
    bool? IsDoneState,
    bool? IsVisible) : IRequest<Result<StatusConfigDto>>;

public class UpdateStatusConfigCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateStatusConfigCommand, Result<StatusConfigDto>>
{
    private static readonly HashSet<string> AllowedColors = new(StringComparer.OrdinalIgnoreCase)
    {
        "neutral", "info", "purple", "warning", "danger", "success",
    };

    public async Task<Result<StatusConfigDto>> Handle(
        UpdateStatusConfigCommand request, CancellationToken ct)
    {
        var config = await db.ProjectStatusConfigs
            .FirstOrDefaultAsync(c => c.Id == request.ConfigId
                                       && c.ProjectId == request.ProjectId, ct);
        if (config is null)
            return Result.Failure<StatusConfigDto>(WorkflowErrors.ConfigNotFound);

        if (request.DisplayName is not null)
        {
            var name = request.DisplayName.Trim();
            if (name.Length is < 1 or > 60)
                return Result.Failure<StatusConfigDto>(WorkflowErrors.InvalidDisplayName);
            config.DisplayName = name;
        }

        if (request.Color is not null)
        {
            var color = request.Color.Trim().ToLowerInvariant();
            if (!AllowedColors.Contains(color))
                return Result.Failure<StatusConfigDto>(WorkflowErrors.InvalidColor);
            config.Color = color;
        }

        if (request.IsDoneState is { } done)
        {
            // Don't allow clearing the last done-state — there has to be
            // somewhere completed tasks can land.
            if (!done && config.IsDoneState)
            {
                var otherDoneStates = await db.ProjectStatusConfigs
                    .CountAsync(c => c.ProjectId == request.ProjectId
                                      && c.Id != config.Id
                                      && c.IsDoneState, ct);
                if (otherDoneStates == 0)
                    return Result.Failure<StatusConfigDto>(WorkflowErrors.NeedOneDoneState);
            }
            config.IsDoneState = done;
        }

        if (request.IsVisible is { } visible)
        {
            config.IsVisible = visible;
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(new StatusConfigDto(
            config.Id, config.ProjectId, config.Status.ToString(), config.DisplayName,
            config.Color, config.OrderIndex, config.IsDoneState, config.IsVisible));
    }
}
