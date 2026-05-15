using Domain.Entities;
using DomainTaskStatus = Domain.Enums.TaskStatus;

namespace Application.Features.Workflow;

/// <summary>
/// Seeded values per project — one row per core <see cref="DomainTaskStatus"/>.
/// The colours are Stratos tone names (neutral/info/purple/danger/success/warning),
/// not raw hex; the frontend resolves them against theme-aware tokens.
/// </summary>
internal static class StatusConfigDefaults
{
    internal record Default(string DisplayName, string Color, int Order, bool IsDoneState);

    private static readonly IReadOnlyDictionary<DomainTaskStatus, Default> Defaults =
        new Dictionary<DomainTaskStatus, Default>
        {
            [DomainTaskStatus.Backlog]    = new("Backlog",     "neutral", 0, false),
            [DomainTaskStatus.ToDo]       = new("To do",       "neutral", 1, false),
            [DomainTaskStatus.InProgress] = new("In progress", "info",    2, false),
            [DomainTaskStatus.InReview]   = new("In review",   "purple",  3, false),
            [DomainTaskStatus.Blocked]    = new("Blocked",     "danger",  4, false),
            [DomainTaskStatus.Done]       = new("Done",        "success", 5, true),
            [DomainTaskStatus.WontDo]     = new("Won't do",    "neutral", 6, true),
        };

    internal static IEnumerable<ProjectStatusConfig> Seed(Guid projectId) =>
        Defaults.Select(kv => new ProjectStatusConfig
        {
            ProjectId = projectId,
            Status = kv.Key,
            DisplayName = kv.Value.DisplayName,
            Color = kv.Value.Color,
            OrderIndex = kv.Value.Order,
            IsDoneState = kv.Value.IsDoneState,
            IsVisible = true,
        });
}
