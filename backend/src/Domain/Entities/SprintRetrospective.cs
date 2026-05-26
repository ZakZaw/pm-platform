namespace Domain.Entities;

/// <summary>
/// AI-generated retrospective for a closed sprint (F2-11). Each closed
/// sprint has at most one retro at a time. Regeneration replaces the
/// row rather than versioning — the audit trail lives in
/// <see cref="AIAuditLog"/>.
///
/// The four narrative fields are editable by the PM; only the
/// <see cref="NextSprintDraftJson"/> payload is opaque to the UI
/// (consumed by <c>ApplyNextSprintDraftCommand</c>).
/// </summary>
public class SprintRetrospective
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SprintId { get; set; }

    public required string Summary { get; set; }
    public required string WhatWentWell { get; set; }
    public required string WhatDidnt { get; set; }
    public required string Suggestions { get; set; }

    /// <summary>JSON of <c>{ name, goal, tasks: [{ taskId, reasoning }] }</c>
    /// — exact shape lives in the Application layer so this entity stays
    /// independent of the AI shape package.</summary>
    public string? NextSprintDraftJson { get; set; }

    public Guid GeneratedByUserId { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Set when the PM has clicked "Apply next sprint draft" —
    /// stops a second click from creating a duplicate sprint.</summary>
    public Guid? AppliedByUserId { get; set; }
    public DateTime? AppliedAt { get; set; }
    public Guid? AppliedSprintId { get; set; }

    public string Provider { get; set; } = "n/a";
    public string Model { get; set; } = "n/a";

    public Sprint Sprint { get; set; } = null!;
}
