namespace Domain.Entities;

/// <summary>
/// Holds the editable draft of an AI-generated project tree between
/// "Generate" and "Confirm". When the user confirms, we read this row
/// and create the real epic/story/task entities in one transaction.
/// </summary>
public class AIGenerationRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid CreatedBy { get; set; }
    public required string Description { get; set; }
    public string Type { get; set; } = "Engineering";
    public string? ClarificationsJson { get; set; }
    public required string PreviewJson { get; set; }
    public string Status { get; set; } = "Draft";   // Draft | Applied | Discarded
    public Guid? AppliedProjectId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AppliedAt { get; set; }
}
