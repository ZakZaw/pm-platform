import {
  CircleCheck,
  CircleDashed,
  Circle,
  CircleDot,
  GitPullRequest,
  OctagonX,
  Slash,
} from 'lucide-react';

// Status -> (tone, icon, label). See /Design Files/shared.jsx for the
// canonical Stratos mapping.
export const STATUS_MAP = {
  Backlog: { tone: 'neutral', Icon: CircleDashed, label: 'Backlog' },
  ToDo: { tone: 'neutral', Icon: Circle, label: 'To do' },
  InProgress: { tone: 'info', Icon: CircleDot, label: 'In progress' },
  InReview: { tone: 'purple', Icon: GitPullRequest, label: 'In review' },
  Blocked: { tone: 'danger', Icon: OctagonX, label: 'Blocked' },
  Done: { tone: 'success', Icon: CircleCheck, label: 'Done' },
  WontDo: { tone: 'neutral', Icon: Slash, label: "Won't do" },
};

export const TASK_STATUSES = Object.keys(STATUS_MAP);
export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label]),
);
