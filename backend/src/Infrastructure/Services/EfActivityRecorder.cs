using System.Text.Json;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;

namespace Infrastructure.Services;

/// <summary>
/// Queues an ActivityLog row onto the scoped AppDbContext. Caller's
/// <c>SaveChangesAsync</c> commits it alongside the rest of the unit of work
/// so a failed handler never leaves an orphan activity row.
/// </summary>
public class EfActivityRecorder(IAppDbContext db) : IActivityRecorder
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public void Record(
        Guid? orgId,
        Guid? projectId,
        Guid actorId,
        ActivityVerb verb,
        string targetType,
        Guid targetId,
        string? summary = null,
        object? metadata = null)
    {
        db.ActivityLogs.Add(new ActivityLog
        {
            OrgId = orgId,
            ProjectId = projectId,
            ActorId = actorId,
            Verb = verb,
            TargetType = targetType,
            TargetId = targetId,
            Summary = summary,
            MetadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata, JsonOptions),
        });
    }
}
