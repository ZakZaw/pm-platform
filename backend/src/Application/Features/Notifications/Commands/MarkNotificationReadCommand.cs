using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Notifications.Commands;

public record MarkNotificationReadCommand(Guid NotificationId) : IRequest<Result>;

public class MarkNotificationReadCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<MarkNotificationReadCommand, Result>
{
    public async Task<Result> Handle(MarkNotificationReadCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var n = await db.Notifications
            .FirstOrDefaultAsync(n => n.Id == request.NotificationId && n.UserId == userId, ct);

        if (n is null)
            return Result.Failure(new Error("Notification.NotFound", "Notification not found."));

        if (n.ReadAt is null)
        {
            n.ReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return Result.Success();
    }
}

public record MarkAllNotificationsReadCommand : IRequest<Result>;

public class MarkAllNotificationsReadCommandHandler(IAppDbContext db, ICurrentUser currentUser)
    : IRequestHandler<MarkAllNotificationsReadCommand, Result>
{
    public async Task<Result> Handle(MarkAllNotificationsReadCommand request, CancellationToken ct)
    {
        if (currentUser.UserId is not { } userId)
            return Result.Failure(AuthErrors.NotAuthenticated);

        var now = DateTime.UtcNow;
        var unread = await db.Notifications
            .Where(n => n.UserId == userId && n.ReadAt == null)
            .ToListAsync(ct);

        foreach (var n in unread) n.ReadAt = now;
        if (unread.Count > 0) await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
