using System.Text.Json;
using Application.Common;
using Domain.Enums;

namespace Application.Features.CustomFields;

/// <summary>
/// Pure validation helpers for the F2-05 custom-field feature. Used by
/// every command that writes a definition or a value so the per-field
/// invariants (option allowed only on select types, value shape matches
/// type) live in one place.
/// </summary>
internal static class CustomFieldValidator
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static Result<string?> ValidateOptions(CustomFieldType type, IReadOnlyList<string>? options)
    {
        var isSelect = type is CustomFieldType.SingleSelect or CustomFieldType.MultiSelect;

        if (!isSelect)
        {
            if (options is { Count: > 0 })
                return Result.Failure<string?>(CustomFieldErrors.OptionsNotAllowed);
            return Result.Success<string?>(null);
        }

        if (options is null || options.Count == 0)
            return Result.Failure<string?>(CustomFieldErrors.OptionsRequired);

        foreach (var opt in options)
        {
            if (string.IsNullOrWhiteSpace(opt) || opt.Length > 120)
                return Result.Failure<string?>(CustomFieldErrors.InvalidOption);
        }

        var normalized = options.Select(o => o.Trim()).ToArray();
        return Result.Success<string?>(JsonSerializer.Serialize(normalized, JsonOptions));
    }

    /// <summary>
    /// Validates a raw JSON value against a field type and (for selects) its
    /// option list. Returns the canonical JSON string to persist, or an
    /// error if the value doesn't fit. A null/empty value clears the field.
    /// </summary>
    public static Result<string?> ValidateValue(CustomFieldType type, string? optionsJson, JsonElement? raw)
    {
        if (raw is null || raw.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return Result.Success<string?>(null);

        var value = raw.Value;

        switch (type)
        {
            case CustomFieldType.Text:
                if (value.ValueKind != JsonValueKind.String)
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                var text = value.GetString();
                return string.IsNullOrEmpty(text)
                    ? Result.Success<string?>(null)
                    : Result.Success<string?>(JsonSerializer.Serialize(text));

            case CustomFieldType.Number:
                if (value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var num))
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                return Result.Success<string?>(JsonSerializer.Serialize(num));

            case CustomFieldType.Date:
                if (value.ValueKind != JsonValueKind.String)
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                var dateStr = value.GetString();
                if (string.IsNullOrEmpty(dateStr))
                    return Result.Success<string?>(null);
                if (!DateOnly.TryParse(dateStr, out var date))
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                return Result.Success<string?>(JsonSerializer.Serialize(date.ToString("O")));

            case CustomFieldType.SingleSelect:
                if (value.ValueKind != JsonValueKind.String)
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                var pick = value.GetString();
                if (string.IsNullOrEmpty(pick))
                    return Result.Success<string?>(null);
                var allowedSingle = ParseOptionList(optionsJson);
                if (!allowedSingle.Contains(pick))
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                return Result.Success<string?>(JsonSerializer.Serialize(pick));

            case CustomFieldType.MultiSelect:
                if (value.ValueKind != JsonValueKind.Array)
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                var picks = new List<string>();
                foreach (var item in value.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String)
                        return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                    var s = item.GetString();
                    if (!string.IsNullOrEmpty(s)) picks.Add(s);
                }
                if (picks.Count == 0) return Result.Success<string?>(null);
                var allowedMulti = ParseOptionList(optionsJson);
                if (picks.Any(p => !allowedMulti.Contains(p)))
                    return Result.Failure<string?>(CustomFieldErrors.InvalidValue);
                return Result.Success<string?>(JsonSerializer.Serialize(picks.Distinct().ToArray()));

            default:
                return Result.Failure<string?>(CustomFieldErrors.InvalidType);
        }
    }

    private static HashSet<string> ParseOptionList(string? optionsJson)
    {
        if (string.IsNullOrEmpty(optionsJson)) return [];
        try
        {
            var arr = JsonSerializer.Deserialize<string[]>(optionsJson, JsonOptions);
            return arr is null ? [] : new HashSet<string>(arr);
        }
        catch
        {
            return [];
        }
    }
}
