using Domain.Enums;

namespace Domain.Entities;

public class ProjectMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public ProjectRole Role { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public Project Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
