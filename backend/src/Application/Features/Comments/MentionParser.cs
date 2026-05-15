using System.Text.RegularExpressions;

namespace Application.Features.Comments;

/// <summary>
/// Pulls @-mentions out of comment markdown. We use the convention
/// "@[Display Name](user-guid)" so the body keeps a human-readable
/// rendering even if the mentioned user's display name later changes,
/// while still letting the server resolve the canonical user id.
/// </summary>
internal static class MentionParser
{
    private static readonly Regex Pattern = new(
        @"@\[(?<name>[^\]]+)\]\((?<id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)",
        RegexOptions.Compiled);

    public static Guid[] Extract(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return [];
        var matches = Pattern.Matches(body);
        if (matches.Count == 0) return [];
        var set = new HashSet<Guid>();
        foreach (Match m in matches)
        {
            if (Guid.TryParse(m.Groups["id"].Value, out var id))
                set.Add(id);
        }
        return set.ToArray();
    }
}
