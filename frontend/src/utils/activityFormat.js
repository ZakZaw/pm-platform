// Shared rendering helpers for project activity-log entries
// (`GET /projects/{id}/activity`). Used by the dashboard activity widget and
// the project home Activity card so both read the same way.

// Human-facing verb phrase. The backend produces a Summary string for some
// verbs (e.g. "moved Auth epic to next quarter"); when present we prefer it
// over our default phrase so the feed reads naturally.
const VERB_PHRASE = {
  TaskCreated: 'created',
  TaskStatusChanged: 'changed the status of',
  TaskAssigned: 'assigned',
  TaskDeleted: 'deleted',
  EpicCreated: 'created the epic',
  EpicUpdated: 'updated the epic',
  EpicDatesChanged: 'rescheduled the epic',
  EpicArchived: 'archived the epic',
  EpicCompleted: 'completed the epic',
  MilestoneCreated: 'added the milestone',
  MilestoneUpdated: 'updated the milestone',
  MilestoneDeleted: 'removed the milestone',
  SprintStarted: 'started the sprint',
  SprintClosed: 'closed the sprint',
  SprintGoalReached: 'reached the goal of',
  CommentAdded: 'commented on',
  EpicDependencyAdded: 'linked an epic dependency',
  EpicDependencyRemoved: 'removed an epic dependency',
};

const TARGET_LABEL = {
  Task: 'task',
  Epic: 'epic',
  Sprint: 'sprint',
  Milestone: 'milestone',
  EpicDependency: 'dependency',
};

/** Compact "how long ago": now / 12m / 3h / 2d / a date. */
export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

/** What happened, without the actor: the recorder's summary or "{verb} the {target}". */
export function describeActivity(entry) {
  const summary = entry.summary?.trim();
  if (summary) return summary;
  const phrase = VERB_PHRASE[entry.verb] ?? entry.verb;
  const targetLabel = TARGET_LABEL[entry.targetType] ?? String(entry.targetType ?? '').toLowerCase();
  return `${phrase} the ${targetLabel}`;
}
