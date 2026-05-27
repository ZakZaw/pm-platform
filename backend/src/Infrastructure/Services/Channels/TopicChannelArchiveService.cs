using Application.Interfaces;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.Channels;

/// <summary>
/// F2-16 — daily sweep that archives Topic channels with no activity in
/// the last 30 days. Org-Wide / Project / Team channels are excluded
/// (those follow their owning entity's lifecycle, not idle time). The
/// service scopes its own DbContext per tick to stay safe alongside
/// scoped EF services.
/// </summary>
public class TopicChannelArchiveService(
    IServiceProvider services,
    ILogger<TopicChannelArchiveService> logger)
    : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan Period = TimeSpan.FromHours(24);
    public static readonly TimeSpan InactivityWindow = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(InitialDelay, stoppingToken);
        }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // Keep the loop alive — one bad sweep shouldn't take
                // the service down.
                logger.LogError(ex, "Topic channel archive sweep failed");
            }

            try
            {
                await Task.Delay(Period, stoppingToken);
            }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepOnceAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();

        var cutoff = DateTime.UtcNow - InactivityWindow;
        var stale = await db.Channels
            .Where(c => c.Type == ChannelType.Topic
                     && c.ArchivedAt == null
                     && c.LastActivityAt < cutoff)
            .ToListAsync(ct);

        if (stale.Count == 0) return;

        foreach (var c in stale)
        {
            c.ArchivedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Archived {Count} idle topic channels (inactive > {Days}d)",
            stale.Count, InactivityWindow.TotalDays);
    }
}
