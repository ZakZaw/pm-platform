namespace Domain.Entities;

public enum PokerSessionStatus
{
    /// <summary>Voting open; individual votes hidden from other members.</summary>
    Voting = 0,
    /// <summary>Votes revealed; everybody can see; no further votes accepted.</summary>
    Revealed = 1,
    /// <summary>Closed and persisted to the task (estimate written or discarded).</summary>
    Closed = 2,
}

/// <summary>
/// A real-time planning-poker round against one task (PM-22). Members
/// drop their votes via SignalR; the host (creator) reveals to flip
/// status. Final estimate can be applied to the task on close. Old
/// sessions are kept for audit.
/// </summary>
public class PokerSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TaskId { get; set; }
    public Guid ProjectId { get; set; }
    public Guid HostUserId { get; set; }
    public PokerSessionStatus Status { get; set; } = PokerSessionStatus.Voting;
    public int? FinalEstimate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RevealedAt { get; set; }
    public DateTime? ClosedAt { get; set; }

    public Task Task { get; set; } = null!;
    public Project Project { get; set; } = null!;
    public User Host { get; set; } = null!;
    public ICollection<PokerVote> Votes { get; set; } = [];
}

public class PokerVote
{
    public Guid SessionId { get; set; }
    public Guid UserId { get; set; }
    /// <summary>Card value as a string so non-numeric ballots ("?",
    /// "coffee") can sit alongside Fibonacci numbers without losing
    /// information.</summary>
    public required string Value { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public PokerSession Session { get; set; } = null!;
    public User User { get; set; } = null!;
}
