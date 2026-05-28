// Single source of truth for the 6 project types introduced in Phase 1.5.
// Each type drives: the create-project chooser, the sidebar vocabulary,
// the AI generation prompt template, and the default dashboard widget set.
// Per-type work-model entities (Account/Lead/Deal for sales, Ticket/Queue
// for support, etc.) ship in F1.5-02..F1.5-06 — until then types other
// than Engineering reuse the universal nav (Dashboard + AI Inbox).

import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Code2,
  Contact,
  FileText,
  FolderKanban,
  GitPullRequest,
  Inbox,
  Layers,
  LifeBuoy,
  ListTodo,
  Map as MapIcon,
  Megaphone,
  Rocket,
  Settings,
  Sparkles,
  UserSquare,
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
    { key: 'roadmap', label: 'Roadmap', icon: MapIcon, path: 'roadmap' },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays, path: 'calendar' },
    { key: 'meetings', label: 'Meetings', icon: CalendarClock, path: 'meetings' },
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3, path: 'dashboard' },
    { key: 'ai', label: 'AI Inbox', icon: Sparkles, path: 'ai' },
  ];
  const settings = [
    { key: 'members', label: 'Members', icon: Users, path: 'settings/members' },
    { key: 'workflow', label: 'Workflow', icon: Settings, path: 'settings/workflow' },
    { key: 'fields', label: 'Fields', icon: ListTodo, path: 'settings/fields' },
    { key: 'ai-settings', label: 'AI', icon: Sparkles, path: 'settings/ai' },
  ];

  if (typeId === 'Engineering') {
    return [
      { key: 'epics', label: 'Epics', icon: Layers, path: 'epics' },
      { key: 'board', label: 'Board', icon: FolderKanban, path: 'board' },
      { key: 'list', label: 'List', icon: ListTodo, path: 'list' },
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

  if (typeId === 'Support') {
    return [
      { key: 'queues', label: 'Queue', icon: Inbox, path: 'queues' },
      { key: 'customers', label: 'Customers', icon: UserSquare, path: 'customers' },
      ...universal,
      ...settings,
    ];
  }

  if (typeId === 'Marketing') {
    // Marketing's "Calendar" comes from the universal nav now (it points
    // to /calendar, which CalendarPage dispatches to ContentCalendarPage
    // for marketing projects). The explicit entry would be a duplicate.
    return [
      { key: 'campaigns', label: 'Campaigns', icon: Megaphone, path: 'campaigns' },
      ...universal,
      ...settings,
    ];
  }

  if (typeId === 'Generic') {
    // No epics, no sprints — just lists of tasks. Calendar slots in
    // alongside Lists once the project-wide calendar view (F2-03) ships.
    return [
      { key: 'lists', label: 'Lists', icon: ListTodo, path: 'lists' },
      ...universal,
      ...settings,
    ];
  }

  if (typeId === 'Operations') {
    return [
      { key: 'runbooks', label: 'Runbooks', icon: Workflow, path: 'runbooks' },
      ...universal,
      ...settings,
    ];
  }

  // Other types: minimal nav until their per-type pages land.
  return [...universal, ...settings];
}

// Returns the design tokens for a Marketing channel chip's text +
// background. Keeps channel theming in one place so the calendar,
// drawer, and campaign list all match.
export function channelTokens(channel) {
  const k = String(channel ?? '').toLowerCase();
  const map = {
    email: { fg: 'var(--mkt-channel-email)', bg: 'var(--mkt-channel-email-bg)' },
    social: { fg: 'var(--mkt-channel-social)', bg: 'var(--mkt-channel-social-bg)' },
    blog: { fg: 'var(--mkt-channel-blog)', bg: 'var(--mkt-channel-blog-bg)' },
    paid: { fg: 'var(--mkt-channel-paid)', bg: 'var(--mkt-channel-paid-bg)' },
    event: { fg: 'var(--mkt-channel-event)', bg: 'var(--mkt-channel-event-bg)' },
  };
  return map[k] ?? { fg: 'var(--mkt-channel-other)', bg: 'var(--mkt-channel-other-bg)' };
}

export const MARKETING_CHANNELS = ['Email', 'Social', 'Blog', 'Paid', 'Event', 'Other'];

export const ASSET_TYPES = ['Email', 'SocialPost', 'BlogPost', 'Ad', 'Image', 'Video', 'LandingPage', 'Other'];

export const ASSET_STATUSES = ['Draft', 'Review', 'Approved', 'Published', 'Archived'];

export const ASSET_STATUS_TONE = {
  Draft: 'neutral',
  Review: 'warning',
  Approved: 'info',
  Published: 'success',
  Archived: 'neutral',
};

export const CAMPAIGN_STATUSES = ['Planning', 'Active', 'Completed', 'Archived'];

export const CAMPAIGN_STATUS_TONE = {
  Planning: 'neutral',
  Active: 'info',
  Completed: 'success',
  Archived: 'neutral',
};
