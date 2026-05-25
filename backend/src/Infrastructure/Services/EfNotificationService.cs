using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;

namespace Infrastructure.Services;

public class EfNotificationService(IAppDbContext db) : INotificationService
{
    public void Enqueue(
        Guid userId,
        Guid orgId,
        Guid? projectId,
        Guid? actorId,
        NotificationKind kind,
        string title,
        string? bodyMd = null,
        string? linkUrl = null,
        string? targetType = null,
        Guid? targetId = null)
    {
        db.Notifications.Add(new Notification
        {
            UserId = userId,
            OrgId = orgId,
            ProjectId = projectId,
            ActorId = actorId,
            Kind = kind,
            Title = title,
            BodyMd = bodyMd,
            LinkUrl = linkUrl,
            TargetType = targetType,
            TargetId = targetId,
        });
    }
}
