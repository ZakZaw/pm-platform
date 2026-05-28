namespace Application.Interfaces;

/// <summary>
/// Canonical event names broadcast on <see cref="IProjectEventBus"/>. Keep
/// them as constants here — typos in handler-side strings silently lose
/// messages. The frontend hub client subscribes to these exact names.
/// </summary>
public static class ProjectEvents
{
    // Phase 1
    public const string BoardChanged = "board.changed";
    public const string SprintChanged = "sprint.changed";
    public const string CommentAdded = "comment.added";

    // F2-01 roadmap
    public const string EpicDatesChanged = "epic.dates_changed";
    public const string EpicDependencyAdded = "epic.dependency_added";
    public const string EpicDependencyRemoved = "epic.dependency_removed";
    public const string MilestoneCreated = "milestone.created";
    public const string MilestoneUpdated = "milestone.updated";
    public const string MilestoneDeleted = "milestone.deleted";

    // Phase 2 cross-cutting
    public const string ActivityRecorded = "activity.recorded";

    // F2-07 PM-22 planning poker
    public const string PokerStarted = "poker.started";
    public const string PokerVoteCast = "poker.vote_cast";
    public const string PokerRevealed = "poker.revealed";
    public const string PokerClosed = "poker.closed";

    // F2-09 task->done automation
    public const string AiSuggestionCreated = "ai.suggestion_created";
}

/// <summary>
/// Per-channel push event names. Delivered via the channel:{guid}
/// SignalR group — every connected channel member subscribes after
/// JoinChannel.
/// </summary>
public static class ChannelEvents
{
    public const string MessagePosted = "chat.message_posted";
    public const string MessageEdited = "chat.message_edited";
    public const string MessageDeleted = "chat.message_deleted";
    public const string ReactionToggled = "chat.reaction_toggled";
}

/// <summary>
/// F2-21 per-meeting push event names. Delivered via the
/// meeting:{guid} SignalR group — clients call JoinMeeting after they
/// enter the room so transcript chunks fan out to that room only.
/// </summary>
public static class MeetingEvents
{
    public const string TranscriptSegment = "meeting.transcript_segment";
}

/// <summary>
/// Per-user push event names (delivered via SignalR Clients.User, not the
/// project group).
/// </summary>
public static class UserEvents
{
    public const string NotificationArrived = "notification.arrived";
}
