using System.Text.RegularExpressions;

namespace Application.Features.Integrations;

/// <summary>
/// F2-23 — pull a task display key (e.g. "AT-247") out of a git ref or
/// PR title. The webhook receiver uses this to link a branch / PR back
/// to the task it works on: <c>feat/AT-247-add-login</c>,
/// <c>AT-247</c>, or "Fix AT-247: flaky test" all resolve to project
/// key "AT" + number 247.
///
/// Pure + allocation-light so it's cheap to unit-test in isolation.
/// </summary>
public static partial class GitTaskKeyParser
{
    // A 2-10 char uppercase-ish project key, a dash, then the number.
    // Case-insensitive so "at-247" from a lowercased branch still hits;
    // callers compare the captured key against the project Key
    // case-insensitively.
    [GeneratedRegex(@"\b([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})\b", RegexOptions.Compiled)]
    private static partial Regex KeyRegex();

    public readonly record struct TaskKeyRef(string ProjectKey, int KeyNum);

    /// <summary>First key-shaped token in the text, or null if none.</summary>
    public static TaskKeyRef? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var m = KeyRegex().Match(text);
        if (!m.Success) return null;
        if (!int.TryParse(m.Groups[2].Value, out var num)) return null;
        return new TaskKeyRef(m.Groups[1].Value.ToUpperInvariant(), num);
    }

    /// <summary>Every distinct key-shaped token, in first-seen order.
    /// Used when a PR body references several tasks.</summary>
    public static IReadOnlyList<TaskKeyRef> ParseAll(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];
        var seen = new HashSet<(string, int)>();
        var result = new List<TaskKeyRef>();
        foreach (Match m in KeyRegex().Matches(text))
        {
            if (!int.TryParse(m.Groups[2].Value, out var num)) continue;
            var key = m.Groups[1].Value.ToUpperInvariant();
            if (seen.Add((key, num))) result.Add(new TaskKeyRef(key, num));
        }
        return result;
    }
}
