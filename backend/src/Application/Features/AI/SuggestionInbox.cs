using Domain.Enums;

namespace Application.Features.AI;

/// <summary>
/// F1.5-08 — pure rules behind the type-aware AI inbox: which category a
/// suggestion <c>Kind</c> belongs to (the inbox's second filter row), and how a
/// cross-project suggestion list groups by originating project type. DB-free
/// and unit-tested (<c>SuggestionInboxTests</c>).
/// </summary>
public static class SuggestionInbox
{
    // Kind prefix → category. New generators register a prefix here; anything
    // unmatched groups as "Other". Order matters only for readability.
    private static readonly (string Prefix, string Category)[] KindPrefixes =
    [
        ("sprint.", "Sprint"),
        ("task.", "Task"),
        ("member.", "Team"),
        ("sales.", "Pipeline"),
        ("deal.", "Pipeline"),
        ("support.", "SLA"),
        ("ticket.", "SLA"),
        ("marketing.", "Content"),
        ("campaign.", "Content"),
        ("asset.", "Content"),
        ("operations.", "Runs"),
        ("ops.", "Runs"),
        ("workflow.", "Runs"),
    ];

    public static string CategoryFor(string? kind)
    {
        if (string.IsNullOrWhiteSpace(kind)) return "Other";
        foreach (var (prefix, category) in KindPrefixes)
            if (kind.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return category;
        return "Other";
    }

    /// <summary>
    /// Groups items by project type in canonical <see cref="ProjectType"/>
    /// order (Engineering → Generic; unknown types last, alphabetically).
    /// Empty groups are omitted; each group keeps items newest-first.
    /// </summary>
    public static IReadOnlyList<(string ProjectType, IReadOnlyList<T> Items)> GroupByType<T>(
        IEnumerable<T> items, Func<T, string> typeOf, Func<T, DateTime> createdAt)
    {
        return items
            .GroupBy(typeOf)
            .OrderBy(g => TypeRank(g.Key))
            .ThenBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => (g.Key, (IReadOnlyList<T>)g.OrderByDescending(createdAt).ToList()))
            .ToList();
    }

    private static int TypeRank(string type) =>
        Enum.TryParse<ProjectType>(type, ignoreCase: false, out var t) ? (int)t : int.MaxValue;
}
