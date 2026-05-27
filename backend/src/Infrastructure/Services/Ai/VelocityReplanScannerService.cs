using Application.Features.AI.Commands;
using Application.Interfaces;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.Ai;

/// <summary>
/// F2-12 — daily background sweep. For every active sprint with an AI
/// gate in Suggest/Autopilot, we send <see cref="GenerateVelocityReplanCommand"/>
/// with ForceGenerate=false so the threshold check inside the command
/// decides whether to spend a Gemini call. The scanner itself doesn't
/// hold projection logic — the command is the single source of truth.
///
/// We deliberately avoid Cron/Quartz: one ticker, ~24h period, and a
/// short initial delay so the first run happens after app boot (and
/// after EF migrations have run on the dev path).
/// </summary>
public class VelocityReplanScannerService(
    IServiceProvider services,
    ILogger<VelocityReplanScannerService> logger)
    : BackgroundService
{
    private static readonly TimeSpan InitialDelay = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan Period = TimeSpan.FromHours(24);

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
                await ScanOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // Never let the loop die. A bad project shouldn't take
                // the whole scanner offline.
                logger.LogError(ex, "Velocity replan scan failed");
            }

            try
            {
                await Task.Delay(Period, stoppingToken);
            }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task ScanOnceAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
        var aiGate = scope.ServiceProvider.GetRequiredService<IAIControlGate>();
        var ai = scope.ServiceProvider.GetRequiredService<IAIService>();

        // Cheap pre-check: if AI isn't configured at all, skip the scan
        // entirely so we don't accumulate a project-by-project audit
        // trail of "no key" failures.
        if (!ai.IsConfigured)
        {
            logger.LogInformation("Velocity replan scan skipped — AI is not configured.");
            return;
        }

        var activeSprints = await db.Sprints
            .Where(s => s.Status == SprintStatus.Active)
            .Select(s => new { s.Id, s.ProjectId })
            .ToListAsync(ct);

        if (activeSprints.Count == 0) return;

        logger.LogInformation(
            "Velocity replan scan: {Count} active sprints", activeSprints.Count);

        var scanned = 0;
        var generated = 0;
        var skipped = 0;
        foreach (var sprint in activeSprints)
        {
            ct.ThrowIfCancellationRequested();
            scanned++;

            // Don't even queue the command when the project has AI off
            // — saves an extra DB round-trip inside the handler.
            if (!await aiGate.IsAllowedAsync(sprint.ProjectId, ct))
            {
                skipped++;
                continue;
            }

            try
            {
                var result = await mediator.Send(
                    new GenerateVelocityReplanCommand(sprint.Id, ForceGenerate: false), ct);
                if (result.IsSuccess)
                {
                    generated++;
                }
            }
            catch (Exception ex)
            {
                // A single failed sprint shouldn't stop the others.
                logger.LogWarning(ex,
                    "Velocity replan generate failed for sprint {SprintId}", sprint.Id);
            }
        }

        logger.LogInformation(
            "Velocity replan scan done: scanned={Scanned} generated={Generated} skipped={Skipped}",
            scanned, generated, skipped);
    }
}
