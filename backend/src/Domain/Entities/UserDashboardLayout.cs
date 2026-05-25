namespace Domain.Entities;

/// <summary>
/// Per-user, per-project dashboard widget layout. The frontend serialises
/// react-grid-layout's <c>[{ i, x, y, w, h }]</c> array as
/// <see cref="LayoutJson"/>. Treated opaquely server-side — schema changes
/// in the frontend don't require a backend migration.
/// </summary>
public class UserDashboardLayout
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid ProjectId { get; set; }
    public required string LayoutJson { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Project Project { get; set; } = null!;
}
