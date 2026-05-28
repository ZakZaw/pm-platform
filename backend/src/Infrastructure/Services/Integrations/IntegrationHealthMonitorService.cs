using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SysTask = System.Threading.Tasks.Task;

namespace Infrastructure.Services.Integrations;

/// <summary>
/// F2-25 — pings every source-control integration on a fixed cadence and
/// records its health. A reachable repo is Healthy; a transient error is
/// Degraded (yellow); a rejected token or a missing repo is Failed (red),
/// which alerts the project's PMs once on the transition into Failed.
///
/// One ticker, ~15-minute period, short initial delay (so it runs after
/// boot + migrations) — same lightweight pattern as the other sweeps.
/// </summary>
public class IntegrationHealthMonitorService(
    IServiceProvider services,
    ILogger<IntegrationHealthMonitorService> logger)
    : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(15);

    protected override async SysTask ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await SysTask.Delay(InitialDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await CheckAllAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex) { logger.LogError(ex, "Integration health sweep failed"); }

            try { await SysTask.Delay(Period, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async SysTask CheckAllAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var github = scope.ServiceProvider.GetRequiredService<IGitHubService>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var integrations = await db.Integrations
            .Where(i => i.Provider == GitProvider.GitHub)
            .ToListAsync(ct);
        if (integrations.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var integration in integrations)
        {
            ct.ThrowIfCancellationRequested();

            var access = await github.CheckRepoAccessAsync(
                integration.RepoFullName, integration.AccessToken, ct);
            var (status, error) = Map(access);

            var health = await db.IntegrationHealth
                .FirstOrDefaultAsync(h => h.IntegrationId == integration.Id, ct);
            var previousStatus = health?.Status ?? IntegrationHealthStatus.Unknown;

            if (health is null)
            {
                health = new IntegrationHealth { IntegrationId = integration.Id };
                db.IntegrationHealth.Add(health);
            }
            health.Status = status;
            health.LastCheckedAt = now;
            health.ErrorMessage = error;
            if (status == IntegrationHealthStatus.Healthy) health.LastSyncedAt = now;

            // Alert the PMs once, on entry into Failed.
            if (status == IntegrationHealthStatus.Failed
                && previousStatus != IntegrationHealthStatus.Failed)
            {
                await AlertProjectManagersAsync(db, notifications, integration, error, ct);
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Integration health sweep checked {Count} integrations", integrations.Count);
    }

    private static (IntegrationHealthStatus, string?) Map(GitHubRepoAccess access) => access switch
    {
        GitHubRepoAccess.Ok => (IntegrationHealthStatus.Healthy, null),
        GitHubRepoAccess.Unauthorized =>
            (IntegrationHealthStatus.Failed, "GitHub rejected the access token — it may have been revoked or expired. Reconnect the repository."),
        GitHubRepoAccess.NotFound =>
            (IntegrationHealthStatus.Failed, "Repository not found or access was removed on GitHub."),
        _ => (IntegrationHealthStatus.Degraded, "Could not reach GitHub — will retry."),
    };

    private static async SysTask AlertProjectManagersAsync(
        IAppDbContext db, INotificationService notifications,
        Integration integration, string? error, CancellationToken ct)
    {
        var project = await db.Projects
            .Where(p => p.Id == integration.ProjectId)
            .Select(p => new { p.OrganizationId, p.Slug, p.Name, OrgSlug = p.Organization!.Slug })
            .FirstOrDefaultAsync(ct);
        if (project?.OrganizationId is not { } orgId) return;

        var pmIds = await db.ProjectMemberships
            .Where(m => m.ProjectId == integration.ProjectId && m.Role == ProjectRole.PM)
            .Select(m => m.UserId)
            .ToListAsync(ct);

        var link = $"/{project.OrgSlug}/projects/{project.Slug}/settings/integrations";
        foreach (var pmId in pmIds)
        {
            notifications.Enqueue(
                userId: pmId,
                orgId: orgId,
                projectId: integration.ProjectId,
                actorId: null,
                kind: NotificationKind.System,
                title: $"GitHub integration failing — {integration.RepoFullName}",
                bodyMd: error,
                linkUrl: link,
                targetType: "Integration",
                targetId: integration.Id);
        }
    }
}
