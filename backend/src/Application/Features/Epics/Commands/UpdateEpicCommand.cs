using Application.Common;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Epics.Commands;

public record UpdateEpicCommand(
    Guid EpicId,
    string? Title,
    string? Description,
    Guid? OwnerId,
    string? Status,
    bool? RiskFlag,
    string? Color) : IRequest<Result<EpicDto>>;

public class UpdateEpicCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateEpicCommand, Result<EpicDto>>
{
    public async Task<Result<EpicDto>> Handle(UpdateEpicCommand request, CancellationToken ct)
    {
        var epic = await db.Epics.FirstOrDefaultAsync(e => e.Id == request.EpicId, ct);
        if (epic is null)
            return Result.Failure<EpicDto>(EpicErrors.NotFound);

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (title.Length < 2 || title.Length > 200)
                return Result.Failure<EpicDto>(EpicErrors.InvalidTitle);
            epic.Title = title;
        }

        if (request.Description is not null) epic.Description = request.Description;
        if (request.OwnerId.HasValue) epic.OwnerId = request.OwnerId;
        if (request.RiskFlag.HasValue) epic.RiskFlag = request.RiskFlag.Value;
        if (request.Color is not null) epic.Color = request.Color;

        if (request.Status is not null)
        {
            if (!Enum.TryParse<EpicStatus>(request.Status, ignoreCase: true, out var status))
                return Result.Failure<EpicDto>(EpicErrors.InvalidStatus);
            epic.Status = status;
            epic.ArchivedAt = status == EpicStatus.Archived ? DateTime.UtcNow : null;
        }

        await db.SaveChangesAsync(ct);

        var tasks = await db.Tasks.Where(t => t.EpicId == epic.Id)
            .Select(t => new { t.StoryPoints, t.Status })
            .ToListAsync(ct);
        var total = tasks.Sum(t => t.StoryPoints ?? 0);
        var done = tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => t.StoryPoints ?? 0);

        return Result.Success(new EpicDto(
            epic.Id, epic.ProjectId, epic.Title, epic.Description, epic.OwnerId,
            epic.Status.ToString(), epic.RiskFlag,
            epic.EnvironmentType?.ToString(), epic.Color,
            epic.CreatedAt, epic.ArchivedAt,
            tasks.Count, total, done));
    }
}
