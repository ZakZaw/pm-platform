using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Notifications.Queries;

public record GetMyNotificationsQuery(
    int Limit = 50,
    DateTime? Before = null,
    bool UnreadOnly = false)
    : IRequest<Result<NotificationInboxDto>>;

public record NotificationInboxDto(
    IReadOnlyList<NotificationDto> Items,
    int UnreadTotal,
    DateTime? NextCursor);

public record NotificationDto(
    Guid Id,
    string Kind,
    string Title,
    string? BodyMd,
    string? LinkUrl,
    string? TargetType,
    Guid? TargetId,
    Guid? ProjectId,
    string? ProjectName,
    Guid? ActorId,
    string? ActorName,
    string? ActorAvatarUrl,
    DateTime CreatedAt,
    DateTime? ReadAt);

public class GetMyNotificationsQueryHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<GetMyNotificationsQuery, Result<NotificationInboxDto>>
{
    public async Task<Result<NotificationInboxDto>> Handle(
        GetMyNotificationsQuery request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure<NotificationInboxDto>(AuthErrors.NotAuthenticated);

        var limit = Math.Clamp(request.Limit, 1, 200);

        var q = db.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .AsQueryable();

        if (request.UnreadOnly)
            q = q.Where(n => n.ReadAt == null);
        if (request.Before is { } before)
            q = q.Where(n => n.CreatedAt < before);

        var rows = await q
            .Take(limit + 1)
            .Select(n => new
            {
                n.Id, Kind = n.Kind.ToString(),
                n.Title, n.BodyMd, n.LinkUrl,
                n.TargetType, n.TargetId,
                n.ProjectId,
                ProjectName = n.Project != null ? n.Project.Name : null,
                n.ActorId,
                ActorName = n.Actor != null ? n.Actor.FullName : null,
                ActorAvatarUrl = n.Actor != null ? n.Actor.AvatarUrl : null,
                n.CreatedAt, n.ReadAt
            })
            .ToListAsync(ct);

        DateTime? nextCursor = null;
        if (rows.Count > limit)
        {
            nextCursor = rows[^1].CreatedAt;
            rows.RemoveAt(rows.Count - 1);
        }

        var unread = await db.Notifications
            .CountAsync(n => n.UserId == userId && n.ReadAt == null, ct);

        var items = rows.Select(r => new NotificationDto(
            r.Id, r.Kind, r.Title, r.BodyMd, r.LinkUrl,
            r.TargetType, r.TargetId,
            r.ProjectId, r.ProjectName,
            r.ActorId, r.ActorName, r.ActorAvatarUrl,
            r.CreatedAt, r.ReadAt)).ToList();

        return Result.Success(new NotificationInboxDto(items, unread, nextCursor));
    }
}
