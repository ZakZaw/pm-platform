using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;

namespace Application.Features.Epics.Commands;

public record CreateEpicCommand(
    Guid ProjectId,
    string Title,
    string? Description,
    Guid? OwnerId,
    string? Color,
    string? EnvironmentType) : IRequest<Result<EpicDto>>;

public class CreateEpicCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateEpicCommand, Result<EpicDto>>
{
    public async Task<Result<EpicDto>> Handle(CreateEpicCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is null)
            return Result.Failure<EpicDto>(AuthErrors.NotAuthenticated);

        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length < 2 || title.Length > 200)
            return Result.Failure<EpicDto>(EpicErrors.InvalidTitle);

        EnvironmentType? env = null;
        if (!string.IsNullOrWhiteSpace(request.EnvironmentType))
        {
            if (!Enum.TryParse<EnvironmentType>(request.EnvironmentType, ignoreCase: true, out var parsed))
                return Result.Failure<EpicDto>(ProjectErrors.InvalidEnvironmentType);
            env = parsed;
        }

        var epic = new Epic
        {
            ProjectId = request.ProjectId,
            Title = title,
            Description = request.Description,
            OwnerId = request.OwnerId,
            Color = request.Color,
            EnvironmentType = env,
            Status = EpicStatus.Planning
        };
        db.Epics.Add(epic);
        await db.SaveChangesAsync(ct);

        return Result.Success(new EpicDto(
            epic.Id, epic.ProjectId, epic.Title, epic.Description, epic.OwnerId,
            epic.Status.ToString(), epic.RiskFlag,
            epic.EnvironmentType?.ToString(), epic.Color,
            epic.CreatedAt, epic.ArchivedAt,
            StoryCount: 0, TotalStoryPoints: 0, DoneStoryPoints: 0));
    }
}
