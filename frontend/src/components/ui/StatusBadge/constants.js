// Maps the backend TaskStatus enum to the new design's .status-{key} capsule.
// Keys: todo / progress / review / done / blocked (see stratos.css).
export const STATUS_MAP = {
  Backlog:    { key: 'todo',     label: 'Backlog' },
  ToDo:       { key: 'todo',     label: 'To do' },
  InProgress: { key: 'progress', label: 'In progress' },
  InReview:   { key: 'review',   label: 'In review' },
  Blocked:    { key: 'blocked',  label: 'Blocked' },
  Done:       { key: 'done',     label: 'Done' },
  WontDo:     { key: 'todo',     label: "Won't do" },
};

export const TASK_STATUSES = Object.keys(STATUS_MAP);
export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label]),
);
