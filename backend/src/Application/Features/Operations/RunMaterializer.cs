using System.Text.Json;
using Application.Interfaces;
using Domain.Entities;
using Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations;

/// <summary>
/// Project-scoped run materialiser. Walks every active workflow in the
/// project and adds <see cref="WorkflowRun"/> rows (plus their checklist
/// items copied from the workflow template) for every occurrence between
/// the last scheduled run and a window <em>horizonDays</em> ahead of now.
/// Idempotent: calling it twice in a row materialises nothing new.
///
/// Lives in Application (not Infrastructure) so query handlers can call
/// it inline — matching the "lazy on read" pattern Support uses for SLA
/// breaches. A future hosted service can call the same code on a timer
/// without touching call sites.
/// </summary>
public static class RunMaterializer
{
    public const int DefaultHorizonDays = 7;

    private static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web);

    public static async Task<int> EnsureUpcomingRunsAsync(
        IAppDbContext db,
        Guid projectId,
        DateTime now,
        int horizonDays = DefaultHorizonDays,
        CancellationToken ct = default)
    {
        var horizon = now.AddDays(horizonDays);

        var workflows = await db.Workflows
            .Where(w => w.ProjectId == projectId && w.ArchivedAt == null)
            .ToListAsync(ct);
        if (workflows.Count == 0) return 0;

        var ids = workflows.Select(w => w.Id).ToList();
        var lastScheduled = await db.WorkflowRuns
            .Where(r => ids.Contains(r.WorkflowId))
            .GroupBy(r => r.WorkflowId)
            .Select(g => new { WorkflowId = g.Key, Max = g.Max(r => (DateTime?)r.ScheduledFor) })
            .ToDictionaryAsync(x => x.WorkflowId, x => x.Max, ct);

        var added = 0;
        foreach (var w in workflows)
        {
            if (string.IsNullOrWhiteSpace(w.RecurrenceRule)) continue;

            // Anchor: the latest existing run, or "now" minus one tick so
            // the first occurrence after that becomes the seed.
            var anchor = lastScheduled.GetValueOrDefault(w.Id) ?? now.AddSeconds(-1);
            var template = ParseTemplate(w.TemplateJson);

            foreach (var when in RecurrenceRuleHelper.Occurrences(w.RecurrenceRule, anchor, horizon))
            {
                var run = new WorkflowRun
                {
                    WorkflowId = w.Id,
                    ScheduledFor = when,
                    OwnerId = w.OwnerId,
                    Status = Domain.Enums.WorkflowRunStatus.Pending,
                };
                db.WorkflowRuns.Add(run);
                foreach (var item in template)
                {
                    db.ChecklistItems.Add(new ChecklistItem
                    {
                        RunId = run.Id,
                        Title = item.Title,
                        Order = item.Order,
                        Sequential = item.Sequential,
                    });
                }
                added++;
            }
        }

        if (added > 0) await db.SaveChangesAsync(ct);
        return added;
    }

    public static IReadOnlyList<ChecklistTemplateItemDto> ParseTemplate(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            var items = JsonSerializer.Deserialize<List<ChecklistTemplateItemDto>>(json, JsonOpts);
            return items ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string SerializeTemplate(IEnumerable<ChecklistTemplateItemDto> items) =>
        JsonSerializer.Serialize(items, JsonOpts);
}
