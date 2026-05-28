using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// F2-22 — a draft to-do extracted by the AI from a meeting transcript.
/// Lives as a draft until a project member either <c>Accepts</c> it
/// (creates a new task or links to an existing one) or
/// <c>Dismisses</c> it. Suggested owner / due / priority come from the
/// AI; the user can override before accepting.
/// </summary>
public class MeetingActionItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MeetingId { get; set; }

    public required string Title { get; set; }
    public string? Description { get; set; }

    /// <summary>Suggested assignee, resolved by the parser from the
    /// attendee list. Null when the AI couldn't pick a confident
    /// owner — the accept flow can still assign one manually.</summary>
    public Guid? SuggestedOwnerUserId { get; set; }

    public DateTime? SuggestedDueDate { get; set; }
    public Priority SuggestedPriority { get; set; } = Priority.Medium;

    /// <summary>Stamped when the item is accepted (
    /// <see cref="AcceptedTaskId"/> is the linked task) — guards
    /// against double-accept races.</summary>
    public DateTime? AcceptedAt { get; set; }
    public Guid? AcceptedTaskId { get; set; }
    public Guid? AcceptedByUserId { get; set; }

    public DateTime? DismissedAt { get; set; }
    public Guid? DismissedByUserId { get; set; }

    /// <summary>Position in the AI's ordered output. Drives the
    /// default render order so a bulk-accept reads top-to-bottom.</summary>
    public int OrderIndex { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Meeting Meeting { get; set; } = null!;
    public User? SuggestedOwner { get; set; }
}
