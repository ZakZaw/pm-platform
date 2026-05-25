using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Schema for a custom field on a project's tasks (F2-05). Defines what
/// shape values take, whether they're required at save time, and (for
/// select fields) the option list. Deletion is soft — the row stays so
/// existing <see cref="CustomFieldValue"/> rows can still resolve their
/// definition, but the field disappears from the task UI.
/// </summary>
public class CustomFieldDefinition
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public CustomFieldType FieldType { get; set; }
    /// <summary>JSON array of option strings for SingleSelect/MultiSelect;
    /// null for other field types.</summary>
    public string? OptionsJson { get; set; }
    public bool Required { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DeletedAt { get; set; }

    public Project Project { get; set; } = null!;
    public ICollection<CustomFieldValue> Values { get; set; } = [];
}
