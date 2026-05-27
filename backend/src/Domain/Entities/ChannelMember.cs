namespace Domain.Entities;

/// <summary>
/// User membership of a <see cref="Channel"/>.
/// <see cref="LastReadAt"/> drives the unread badge: any channel
/// activity newer than this timestamp counts as unread for this user.
/// </summary>
public class ChannelMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChannelId { get; set; }
    public Guid UserId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastReadAt { get; set; }

    public Channel Channel { get; set; } = null!;
    public User User { get; set; } = null!;
}
