using Domain.Enums;

namespace Domain.Entities;

public class Epic
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
    public Guid? OwnerId { get; set; }
    public EpicStatus Status { get; set; } = EpicStatus.Planning;
    public bool RiskFlag { get; set; }
    public EnvironmentType? EnvironmentType { get; set; }
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ArchivedAt { get; set; }

    public Project Project { get; set; } = null!;
    public User? Owner { get; set; }
    public ICollection<Story> Stories { get; set; } = [];
}
