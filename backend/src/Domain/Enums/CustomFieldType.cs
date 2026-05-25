namespace Domain.Enums;

/// <summary>
/// Supported custom-field shapes (F2-05). Defines how values are validated,
/// stored in <see cref="Domain.Entities.CustomFieldValue.ValueJson"/>, and
/// rendered in TaskForm / TaskDetail.
/// </summary>
public enum CustomFieldType
{
    /// <summary>Free-form string. Stored as JSON string.</summary>
    Text,

    /// <summary>Decimal number. Stored as JSON number.</summary>
    Number,

    /// <summary>ISO date (no time). Stored as JSON string "YYYY-MM-DD".</summary>
    Date,

    /// <summary>One option from the definition's options list. Stored as
    /// JSON string matching one of the option values.</summary>
    SingleSelect,

    /// <summary>Zero-or-more options. Stored as JSON array of strings.</summary>
    MultiSelect
}
