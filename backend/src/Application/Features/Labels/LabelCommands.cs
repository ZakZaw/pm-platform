using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Labels;

public record LabelDto(Guid Id, Guid ProjectId, string Name, string Color);

public static class LabelTones
{
    public static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "neutral", "info", "purple", "warning", "danger", "success", "accent", "rose",
    };

    public static string? Normalise(string? raw)
    {
        var t = (raw ?? string.Empty).Trim().ToLowerInvariant();
        return Allowed.Contains(t) ? t : null;
    }
}

public record CreateLabelCommand(Guid ProjectId, string Name, string Color)
    : IRequest<Result<LabelDto>>;

public class CreateLabelCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<CreateLabelCommand, Result<LabelDto>>
{
    public async Task<Result<LabelDto>> Handle(CreateLabelCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is null) return Result.Failure<LabelDto>(AuthErrors.NotAuthenticated);

        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length is < 1 or > 60) return Result.Failure<LabelDto>(LabelErrors.InvalidName);

        var tone = LabelTones.Normalise(request.Color);
        if (tone is null) return Result.Failure<LabelDto>(LabelErrors.InvalidColor);

        var projectExists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!projectExists) return Result.Failure<LabelDto>(ProjectErrors.NotFound);

        var dup = await db.Labels
            .AnyAsync(l => l.ProjectId == request.ProjectId && l.Name.ToLower() == name.ToLower(), ct);
        if (dup) return Result.Failure<LabelDto>(LabelErrors.DuplicateName);

        var label = new Label
        {
            ProjectId = request.ProjectId,
            Name = name,
            Color = tone,
        };
        db.Labels.Add(label);
        await db.SaveChangesAsync(ct);

        return Result.Success(new LabelDto(label.Id, label.ProjectId, label.Name, label.Color));
    }
}

public record UpdateLabelCommand(Guid LabelId, string? Name, string? Color)
    : IRequest<Result<LabelDto>>;

public class UpdateLabelCommandHandler(IAppDbContext db)
    : IRequestHandler<UpdateLabelCommand, Result<LabelDto>>
{
    public async Task<Result<LabelDto>> Handle(UpdateLabelCommand request, CancellationToken ct)
    {
        var label = await db.Labels.FirstOrDefaultAsync(l => l.Id == request.LabelId, ct);
        if (label is null) return Result.Failure<LabelDto>(LabelErrors.NotFound);

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length is < 1 or > 60) return Result.Failure<LabelDto>(LabelErrors.InvalidName);
            var lower = name.ToLower();
            var dup = await db.Labels.AnyAsync(l =>
                l.ProjectId == label.ProjectId &&
                l.Id != label.Id &&
                l.Name.ToLower() == lower, ct);
            if (dup) return Result.Failure<LabelDto>(LabelErrors.DuplicateName);
            label.Name = name;
        }

        if (request.Color is not null)
        {
            var tone = LabelTones.Normalise(request.Color);
            if (tone is null) return Result.Failure<LabelDto>(LabelErrors.InvalidColor);
            label.Color = tone;
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new LabelDto(label.Id, label.ProjectId, label.Name, label.Color));
    }
}

public record DeleteLabelCommand(Guid LabelId) : IRequest<Result>;

public class DeleteLabelCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteLabelCommand, Result>
{
    public async Task<Result> Handle(DeleteLabelCommand request, CancellationToken ct)
    {
        var label = await db.Labels.FirstOrDefaultAsync(l => l.Id == request.LabelId, ct);
        if (label is null) return Result.Failure(LabelErrors.NotFound);
        db.Labels.Remove(label);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public record ListTaskLabelsQuery(Guid TaskId) : IRequest<Result<IReadOnlyList<LabelDto>>>;

public class ListTaskLabelsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskLabelsQuery, Result<IReadOnlyList<LabelDto>>>
{
    public async Task<Result<IReadOnlyList<LabelDto>>> Handle(
        ListTaskLabelsQuery request, CancellationToken ct)
    {
        var exists = await db.Tasks.AnyAsync(t => t.Id == request.TaskId, ct);
        if (!exists) return Result.Failure<IReadOnlyList<LabelDto>>(TaskErrors.NotFound);

        var rows = await db.TaskLabels
            .Where(tl => tl.TaskId == request.TaskId)
            .Select(tl => new LabelDto(tl.Label.Id, tl.Label.ProjectId, tl.Label.Name, tl.Label.Color))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<LabelDto>>(rows);
    }
}

public record ListProjectLabelsQuery(Guid ProjectId) : IRequest<Result<IReadOnlyList<LabelDto>>>;

public class ListProjectLabelsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListProjectLabelsQuery, Result<IReadOnlyList<LabelDto>>>
{
    public async Task<Result<IReadOnlyList<LabelDto>>> Handle(
        ListProjectLabelsQuery request, CancellationToken ct)
    {
        var exists = await db.Projects.AnyAsync(p => p.Id == request.ProjectId, ct);
        if (!exists) return Result.Failure<IReadOnlyList<LabelDto>>(ProjectErrors.NotFound);

        var rows = await db.Labels
            .Where(l => l.ProjectId == request.ProjectId)
            .OrderBy(l => l.Name)
            .Select(l => new LabelDto(l.Id, l.ProjectId, l.Name, l.Color))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<LabelDto>>(rows);
    }
}

public record SetTaskLabelsCommand(Guid TaskId, IReadOnlyList<Guid> LabelIds)
    : IRequest<Result<IReadOnlyList<LabelDto>>>;

public class SetTaskLabelsCommandHandler(IAppDbContext db)
    : IRequestHandler<SetTaskLabelsCommand, Result<IReadOnlyList<LabelDto>>>
{
    public async Task<Result<IReadOnlyList<LabelDto>>> Handle(
        SetTaskLabelsCommand request, CancellationToken ct)
    {
        var task = await db.Tasks
            .Where(t => t.Id == request.TaskId)
            .Select(t => new { t.Id, t.ProjectId })
            .FirstOrDefaultAsync(ct);
        if (task is null) return Result.Failure<IReadOnlyList<LabelDto>>(TaskErrors.NotFound);

        var ids = (request.LabelIds ?? []).Distinct().ToList();
        if (ids.Count > 0)
        {
            var labels = await db.Labels
                .Where(l => ids.Contains(l.Id))
                .Select(l => new { l.Id, l.ProjectId })
                .ToListAsync(ct);

            if (labels.Count != ids.Count)
                return Result.Failure<IReadOnlyList<LabelDto>>(LabelErrors.NotFound);
            if (labels.Any(l => l.ProjectId != task.ProjectId))
                return Result.Failure<IReadOnlyList<LabelDto>>(LabelErrors.NotInProject);
        }

        var existing = await db.TaskLabels.Where(tl => tl.TaskId == task.Id).ToListAsync(ct);
        var existingIds = existing.Select(e => e.LabelId).ToHashSet();
        var nextIds = ids.ToHashSet();

        var toRemove = existing.Where(e => !nextIds.Contains(e.LabelId)).ToList();
        var toAdd = ids.Where(id => !existingIds.Contains(id))
            .Select(id => new TaskLabel { TaskId = task.Id, LabelId = id })
            .ToList();

        if (toRemove.Count > 0) db.TaskLabels.RemoveRange(toRemove);
        if (toAdd.Count > 0) db.TaskLabels.AddRange(toAdd);
        await db.SaveChangesAsync(ct);

        var result = await db.TaskLabels
            .Where(tl => tl.TaskId == task.Id)
            .Select(tl => new LabelDto(tl.Label.Id, tl.Label.ProjectId, tl.Label.Name, tl.Label.Color))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<LabelDto>>(result);
    }
}
