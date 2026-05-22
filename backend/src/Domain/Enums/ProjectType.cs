namespace Domain.Enums;

/// <summary>
/// Drives the project's work model. Each type registers a different set of
/// entities, default views, state machine, and AI generation prompt via
/// <c>IProjectTypeProvider</c>. The app shell, settings, members, roadmap,
/// dashboard, chat, meetings, AI inbox, and integrations stay shared across
/// all types — only the work model differs.
/// </summary>
public enum ProjectType
{
    /// <summary>Epic → Task → Subtask, Sprint Kanban, burndown.
    /// What Phase 1 originally shipped.</summary>
    Engineering,

    /// <summary>Account → Lead → Deal → Stage → Activity, CRM-style pipeline.</summary>
    Sales,

    /// <summary>Customer → Ticket → Queue, SLA timers, reply threads.</summary>
    Support,

    /// <summary>Campaign → Asset → Task, channel content calendar.</summary>
    Marketing,

    /// <summary>Workflow → Run → ChecklistItem, recurring runbooks.</summary>
    Operations,

    /// <summary>Lightweight tasks in lists. No epics, no sprints.</summary>
    Generic
}
