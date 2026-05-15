namespace Domain.Entities;

/// <summary>
/// Append-only audit record for every AI action. Required by the design
/// doc: each AI write must be reversible within 24h, so we capture the
/// prompt, raw response, before/after state, and who applied it.
/// </summary>
public class AIAuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string ActionType { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? UserId { get; set; }
    public required string Prompt { get; set; }
    public string? Response { get; set; }
    public string? BeforeStateJson { get; set; }
    public string? AfterStateJson { get; set; }
    public string Provider { get; set; } = "gemini";
    public string? Model { get; set; }
    public bool Applied { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AppliedAt { get; set; }
}
