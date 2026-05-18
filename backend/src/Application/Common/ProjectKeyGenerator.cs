using System.Text;

namespace Application.Common;

/// <summary>
/// Produces the 2–4 character prefix used to build human-friendly task IDs
/// like "AT-247". Rule:
///   • Take the first two letters of the project name (A–Z only, uppercased).
///   • If only one letter is usable, pad to "X·" with the next letter or 'X'.
///   • If empty (name was all symbols), fall back to "PR".
/// Caller is responsible for collision resolution within the project's org —
/// see <see cref="WithSuffix"/>.
/// </summary>
public static class ProjectKeyGenerator
{
    public static string From(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "PR";

        var letters = new StringBuilder(2);
        foreach (var c in name)
        {
            if (char.IsLetter(c))
            {
                letters.Append(char.ToUpperInvariant(c));
                if (letters.Length == 2) break;
            }
        }

        if (letters.Length == 0) return "PR";
        if (letters.Length == 1) return letters.Append('X').ToString();
        return letters.ToString();
    }

    /// <summary>Append a positive integer suffix to a base key, e.g.
    /// ("AT", 2) → "AT2". Used to disambiguate collisions inside an org.
    /// Caps total length at 8 (matches the column constraint).</summary>
    public static string WithSuffix(string baseKey, int suffix)
    {
        if (suffix <= 1) return baseKey;
        var combined = baseKey + suffix.ToString();
        return combined.Length > 8 ? combined.Substring(0, 8) : combined;
    }
}
