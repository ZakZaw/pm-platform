using Application.Common;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.TimeLogs;

public record TimeLogDto(
    Guid Id,
    Guid TaskId,
    Guid UserId,
    string? UserName,
    int Minutes,
    DateTime LoggedAt,
    string? Comment,
    DateTime CreatedAt);

public record LogTimeCommand(
    Guid TaskId,
    int Minutes,
    DateTime? LoggedAt,
    string? Comment) : IRequest<Result<TimeLogDto>>;

public class LogTimeCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<LogTimeCommand, Result<TimeLogDto>>
{
    public async Task<Result<TimeLogDto>> Handle(LogTimeCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<TimeLogDto>(AuthErrors.NotAuthenticated);

        if (request.Minutes is < 1 or > 1440)
            return Result.Failure<TimeLogDto>(TimeLogErrors.InvalidMinutes);

        var task = await db.Tasks.FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task is null) return Result.Failure<TimeLogDto>(TaskErrors.NotFound);

        var entry = new TimeLog
        {
            TaskId = task.Id,
            UserId = userId,
            Minutes = request.Minutes,
            LoggedAt = (request.LoggedAt ?? DateTime.UtcNow).ToUniversalTime(),
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment!.Trim(),
        };
        db.TimeLogs.Add(entry);
        task.TimeLoggedMinutes += request.Minutes;
        await db.SaveChangesAsync(ct);

        var name = await db.Users.Where(u => u.Id == userId).Select(u => u.FullName).FirstOrDefaultAsync(ct);

        return Result.Success(new TimeLogDto(
            entry.Id, entry.TaskId, entry.UserId, name,
            entry.Minutes, entry.LoggedAt, entry.Comment, entry.CreatedAt));
    }
}

public record DeleteTimeLogCommand(Guid TimeLogId) : IRequest<Result>;

public class DeleteTimeLogCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<DeleteTimeLogCommand, Result>
{
    public async Task<Result> Handle(DeleteTimeLogCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var entry = await db.TimeLogs
            .Include(t => t.Task)
            .FirstOrDefaultAsync(t => t.Id == request.TimeLogId, ct);
        if (entry is null) return Result.Failure(TimeLogErrors.NotFound);

        if (entry.UserId != userId)
        {
            var role = await db.ProjectMemberships
                .Where(m => m.ProjectId == entry.Task.ProjectId && m.UserId == userId)
                .Select(m => (ProjectRole?)m.Role)
                .FirstOrDefaultAsync(ct);
            if (role != ProjectRole.PM) return Result.Failure(TimeLogErrors.Forbidden);
        }

        entry.Task.TimeLoggedMinutes = Math.Max(0, entry.Task.TimeLoggedMinutes - entry.Minutes);
        db.TimeLogs.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

public record ListTaskTimeLogsQuery(Guid TaskId) : IRequest<Result<IReadOnlyList<TimeLogDto>>>;

public class ListTaskTimeLogsQueryHandler(IAppDbContext db)
    : IRequestHandler<ListTaskTimeLogsQuery, Result<IReadOnlyList<TimeLogDto>>>
{
    public async Task<Result<IReadOnlyList<TimeLogDto>>> Handle(
        ListTaskTimeLogsQuery request, CancellationToken ct)
    {
        var exists = await db.Tasks.AnyAsync(t => t.Id == request.TaskId, ct);
        if (!exists) return Result.Failure<IReadOnlyList<TimeLogDto>>(TaskErrors.NotFound);

        var rows = await db.TimeLogs
            .Where(t => t.TaskId == request.TaskId)
            .OrderByDescending(t => t.LoggedAt)
            .Select(t => new TimeLogDto(
                t.Id, t.TaskId, t.UserId, t.User.FullName,
                t.Minutes, t.LoggedAt, t.Comment, t.CreatedAt))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<TimeLogDto>>(rows);
    }
}
