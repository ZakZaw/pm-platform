namespace Domain.Enums;

/// <summary>
/// Verbs used in the project activity feed. New verbs are added here as
/// features need them; the frontend has a renderer per verb.
/// </summary>
public enum ActivityVerb
{
    // Tasks
    TaskCreated,
    TaskStatusChanged,
    TaskAssigned,
    TaskDeleted,

    // Epics
    EpicCreated,
    EpicUpdated,
    EpicDatesChanged,
    EpicArchived,
    EpicCompleted,

    // Milestones (F2-01)
    MilestoneCreated,
    MilestoneUpdated,
    MilestoneDeleted,

    // Sprints
    SprintStarted,
    SprintClosed,
    SprintGoalReached,

    // Comments
    CommentAdded,

    // Roadmap dependencies (F2-01)
    EpicDependencyAdded,
    EpicDependencyRemoved
}
