namespace Domain.Entities;

/// <summary>
/// Durable AI insight surfaced in the project's AI Inbox.
/// Where transient AI flows (estimate, breakdown, fill-sprint) live on a
/// single screen, an AISuggestion sticks around until the PM acts on it.
/// </summary>
public class AISuggestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }

    /// <summary>
    /// Discriminator used by the UI to pick a render variant.
    /// Examples: "sprint.health", "sprint.replan", "task.blocked.stale".
    /// </summary>
    public required string Kind { get; set; }

    public required string Title { get; set; }
    public string? Body { get; set; }

    /// <summary>JSON payload — schema depends on <see cref="Kind"/>.</summary>
    public string? PayloadJson { get; set; }

    /// <summary>
    /// Open / Accepted / Dismissed. Open suggestions show in the inbox;
    /// acted-on ones are kept for history but filtered out of the default
    /// list view.
    /// </summary>
    public string Status { get; set; } = "Open";

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid? ActedByUserId { get; set; }
    public DateTime? ActedAt { get; set; }

    public string Provider { get; set; } = "n/a";
    public string Model { get; set; } = "n/a";

    public Project Project { get; set; } = null!;
}
