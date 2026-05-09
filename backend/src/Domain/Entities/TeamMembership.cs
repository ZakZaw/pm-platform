namespace Domain.Entities;

public class TeamMembership
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public Team Team { get; set; } = null!;
    public User User { get; set; } = null!;
}
