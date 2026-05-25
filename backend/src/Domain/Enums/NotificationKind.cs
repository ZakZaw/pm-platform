namespace Domain.Enums;

/// <summary>
/// Categories of in-app notification. The frontend renders each kind with a
/// distinct icon + tone. Add new kinds here as features need them.
/// </summary>
public enum NotificationKind
{
    Mention,
    TaskAssigned,
    TaskStatusChanged,
    TaskDue,
    EpicDatesChanged,
    MilestoneAdded,
    SprintStarted,
    SprintClosed,
    ProjectInvite,
    AiSuggestion,
    System
}
