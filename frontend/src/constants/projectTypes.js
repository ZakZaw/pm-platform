// Single source of truth for the 6 project types introduced in Phase 1.5.
// Each type drives: the create-project chooser, the sidebar vocabulary,
// the AI generation prompt template, and the default dashboard widget set.
// Per-type work-model entities (Account/Lead/Deal for sales, Ticket/Queue
// for support, etc.) ship in F1.5-02..F1.5-06 — until then types other
// than Engineering reuse the universal nav (Dashboard + AI Inbox).

import {
  BarChart3,
  Briefcase,
  ClipboardList,
  Code2,
  Contact,
  FileText,
  FolderKanban,
  GitPullRequest,
  Layers,
  LifeBuoy,
  Megaphone,
  Rocket,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';

export const PROJECT_TYPES = [
  {
    id: 'Engineering',
    label: 'Engineering',
    short: 'Eng',
    description: 'Epics, tasks, sprints, kanban — for software teams.',
    icon: Code2,
  },
  {
    id: 'Sales',
    label: 'Sales',
    short: 'Sales',
    description: 'Accounts, leads, deals — a CRM-style pipeline.',
    icon: BarChart3,
  },
  {
    id: 'Support',
    label: 'Support',
    short: 'Support',
    description: 'Tickets, queues, SLAs, customer view.',
    icon: LifeBuoy,
  },
  {
    id: 'Marketing',
    label: 'Marketing',
    short: 'Mkt',
    description: 'Campaigns, assets, content calendar.',
    icon: Megaphone,
  },
  {
    id: 'Operations',
    label: 'Operations',
    short: 'Ops',
    description: 'Recurring workflows, runbooks, checklists.',
    icon: Workflow,
  },
  {
    id: 'Generic',
    label: 'Generic',
    short: 'Generic',
    description: 'Lightweight tasks in lists. No epics or sprints.',
    icon: FileText,
  },
];

export const DEFAULT_PROJECT_TYPE_ID = 'Engineering';

export function findProjectType(id) {
  return (
    PROJECT_TYPES.find((t) => t.id === id) ??
    PROJECT_TYPES.find((t) => t.id === DEFAULT_PROJECT_TYPE_ID)
  );
}

// Sidebar nav items per type. Each entry is rendered as a sub-item under
// the active project in `Sidebar.jsx`. F1.5-01 wires up only Engineering
// with its full nav; the per-type nav for the other types lands with
// their entity work (F1.5-02..F1.5-06).
export function navItemsForType(typeId) {
  const universal = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, path: 'dashboard' },
    { key: 'ai', label: 'AI Inbox', icon: Sparkles, path: 'ai' },
  ];
  const settings = [
    { key: 'members', label: 'Members', icon: Users, path: 'settings/members' },
    { key: 'workflow', label: 'Workflow', icon: Settings, path: 'settings/workflow' },
  ];

  if (typeId === 'Engineering') {
    return [
      { key: 'epics', label: 'Epics', icon: Layers, path: 'epics' },
      { key: 'board', label: 'Board', icon: FolderKanban, path: 'board' },
      ...universal,
      { key: 'backlog', label: 'Backlog', icon: ClipboardList, path: 'backlog' },
      { key: 'sprints', label: 'Sprints', icon: Rocket, path: 'sprints' },
      ...settings,
    ];
  }

  if (typeId === 'Sales') {
    return [
      { key: 'pipeline', label: 'Pipeline', icon: GitPullRequest, path: 'pipeline' },
      { key: 'accounts', label: 'Accounts', icon: Briefcase, path: 'accounts' },
      { key: 'leads', label: 'Leads', icon: Contact, path: 'leads' },
      ...universal,
      ...settings,
    ];
  }

  // Other types: minimal nav until their per-type pages land. The work-
  // model pages slot in here once F1.5-03..F1.5-06 ship.
  return [...universal, ...settings];
}
