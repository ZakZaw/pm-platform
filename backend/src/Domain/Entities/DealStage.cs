namespace Domain.Entities;

/// <summary>
/// A column in a Sales project's pipeline. Created with sensible defaults
/// when a Sales project is provisioned (Discover / Qualify / Propose /
/// Negotiate / Closed Won / Closed Lost) and editable afterwards. Two
/// terminal flavors carry semantics: <see cref="IsTerminalWon"/> stages
/// flip <see cref="Deal.Status"/> to Won; <see cref="IsTerminalLost"/>
/// flips to Lost and requires a reason.
/// </summary>
public class DealStage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Name { get; set; }
    public int Order { get; set; }
    public int DefaultProbability { get; set; }
    public bool IsTerminalWon { get; set; }
    public bool IsTerminalLost { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public ICollection<Deal> Deals { get; set; } = [];
}
