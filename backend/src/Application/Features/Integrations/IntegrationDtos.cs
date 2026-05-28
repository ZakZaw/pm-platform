namespace Application.Features.Integrations;

/// <summary>F2-23 — a connected source-control repo, as shown on the
/// project's integrations settings page. Never exposes the access
/// token or webhook secret.</summary>
public record IntegrationDto(
    Guid Id,
    Guid ProjectId,
    string Provider,
    string RepoFullName,
    string RepoUrl,
    bool WebhookActive,
    string ConnectedByName,
    DateTime CreatedAt,
    DateTime? LastEventAt,
    // F2-25 health snapshot.
    string Health,
    DateTime? HealthCheckedAt,
    DateTime? LastSyncedAt,
    string? HealthError);

/// <summary>Returned by the authorize endpoint — the URL the browser
/// should be sent to in order to start the GitHub OAuth consent.</summary>
public record GitHubAuthorizeDto(string AuthorizeUrl);
