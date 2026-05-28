using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// F2-23 — a connection between a project and an external source-control
/// repository (GitHub in F2-23). Created by the OAuth callback once the
/// user has authorised access and picked a repo. Holds the OAuth access
/// token (used to register the repo webhook and call back into the API)
/// and a per-integration <see cref="WebhookSecret"/> that signs the
/// inbound webhook payloads — every delivery is HMAC-verified against it.
///
/// A repo maps to a single project so webhook routing is unambiguous;
/// the unique index on (<see cref="Provider"/>, <see cref="RepoFullName"/>)
/// enforces that.
/// </summary>
public class Integration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }

    public GitProvider Provider { get; set; } = GitProvider.GitHub;

    /// <summary>Canonical "owner/repo" slug, e.g. "acme/web-app".</summary>
    public required string RepoFullName { get; set; }

    /// <summary>OAuth access token. Stored as-is in dev (same posture as
    /// the other provider secrets in this codebase); a production
    /// hardening pass would wrap this at rest.</summary>
    public string? AccessToken { get; set; }

    /// <summary>HMAC secret shared with the GitHub webhook. Generated on
    /// connect and never exposed to the client.</summary>
    public required string WebhookSecret { get; set; }

    /// <summary>GitHub's numeric hook id, when we successfully registered
    /// the webhook via the API — lets disconnect delete it again.</summary>
    public long? WebhookId { get; set; }

    public Guid ConnectedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Stamp of the most recent webhook delivery — surfaced on
    /// the settings page so a dead connection is obvious.</summary>
    public DateTime? LastEventAt { get; set; }

    public Project Project { get; set; } = null!;
    public User ConnectedBy { get; set; } = null!;
}
