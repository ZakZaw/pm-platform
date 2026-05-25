using TaskEntity = Domain.Entities.Task;

namespace Domain.Entities;

/// <summary>
/// One task's value for one custom field (F2-05). <see cref="ValueJson"/>
/// is the canonical store: a string for Text/Date/SingleSelect, a number
/// for Number, a JSON array for MultiSelect. Application-layer commands
/// validate the JSON shape against the definition's
/// <see cref="CustomFieldDefinition.FieldType"/> before persisting.
/// </summary>
public class CustomFieldValue
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid DefinitionId { get; set; }
    public required string ValueJson { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public TaskEntity Task { get; set; } = null!;
    public CustomFieldDefinition Definition { get; set; } = null!;
}
