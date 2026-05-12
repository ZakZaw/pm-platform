using System.Globalization;
using System.Text;

namespace Application.Common;

public static class SlugGenerator
{
    public static string From(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;

        var normalized = input.Normalize(NormalizationForm.FormKD);
        var sb = new StringBuilder(normalized.Length);
        var lastDash = true;
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;

            if (char.IsLetterOrDigit(c))
            {
                sb.Append(char.ToLowerInvariant(c));
                lastDash = false;
            }
            else if (!lastDash)
            {
                sb.Append('-');
                lastDash = true;
            }
        }

        return sb.ToString().Trim('-');
    }
}
