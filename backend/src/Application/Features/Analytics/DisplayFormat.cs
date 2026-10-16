namespace Application.Features.Analytics;

/// <summary>
/// Pure display formatting shared by the server-composed dashboard tiles
/// (portfolio headline, project home KPIs): compact money, compact durations,
/// percentages and signed deltas. Kept in one place so every surface renders
/// the same number the same way.
/// </summary>
public static class DisplayFormat
{
    /// <summary>Compact money for an exec rollup: $1.2M / $14k / $850.</summary>
    public static string Money(decimal value, string? currency)
    {
        var sym = (currency ?? "USD") switch
        {
            "USD" => "$", "EUR" => "€", "GBP" => "£", "JPY" => "¥",
            var other => other + " ",
        };
        var sign = value < 0 ? "-" : "";
        var abs = Math.Abs(value);
        return abs switch
        {
            >= 1_000_000 => $"{sign}{sym}{abs / 1_000_000m:0.#}M",
            >= 1_000 => $"{sign}{sym}{abs / 1_000m:0.#}k",
            _ => $"{sign}{sym}{abs:0}",
        };
    }

    /// <summary>Compact duration from hours: 45m / 3.5h / 2.1d.</summary>
    public static string Duration(double hours)
    {
        if (hours < 1) return $"{Math.Max(0, Math.Round(hours * 60)):0}m";
        if (hours < 24) return $"{hours:0.#}h";
        return $"{hours / 24:0.#}d";
    }

    /// <summary>Whole-number percentage, e.g. 94%.</summary>
    public static string Pct(double pct) => $"{Math.Round(pct, MidpointRounding.AwayFromZero):0}%";

    /// <summary>Signed number with a suffix: "+3", "-0.4d", "+12%". Zero renders as "±0".</summary>
    public static string Signed(double value, string suffix = "", string format = "0.#")
    {
        var rounded = Math.Round(value, 1);
        if (rounded == 0) return $"±0{suffix}";
        return (rounded > 0 ? "+" : "-") + Math.Abs(rounded).ToString(format) + suffix;
    }
}
