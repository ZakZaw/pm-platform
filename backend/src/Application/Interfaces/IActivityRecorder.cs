using Domain.Enums;

namespace Application.Interfaces;

/// <summary>
/// Records a row in the project activity feed. Handlers call this explicitly
/// after a successful write so the resulting feed entry can be semantically
/// rich (verb + target + summary + metadata) rather than a generic
/// "command-executed" stamp.
///
/// The implementation queues the row to be saved alongside the command's
/// own writes (it appends to <see cref="IAppDbContext.SaveChangesAsync"/>).
/// </summary>
public interface IActivityRecorder
{
    /// <summary>
    /// Queue an activity-log row. Caller is expected to call
    /// <c>db.SaveChangesAsync</c> in the same unit of work; this method does
    /// not save on its own.
    /// </summary>
    void Record(
        Guid? orgId,
        Guid? projectId,
        Guid actorId,
        ActivityVerb verb,
        string targetType,
        Guid targetId,
        string? summary = null,
        object? metadata = null);
}
