// Mock data for all project types — keep shapes realistic.

const ORGS = [
  { id: 'lattice', name: 'Lattice Labs', slug: 'lattice', logo: 'L' },
];

const MEMBERS = [
  { id: 'u1', name: 'Aria Chen',    initials: 'AC', color: 0, role: 'PM',        tz: 'PST' },
  { id: 'u2', name: 'Noor Idris',   initials: 'NI', color: 1, role: 'Lead',      tz: 'CET' },
  { id: 'u3', name: 'Theo Park',    initials: 'TP', color: 2, role: 'Eng',       tz: 'EST' },
  { id: 'u4', name: 'Maya Singh',   initials: 'MS', color: 3, role: 'Eng',       tz: 'IST' },
  { id: 'u5', name: 'Sam Rivera',   initials: 'SR', color: 4, role: 'Design',    tz: 'PST' },
  { id: 'u6', name: 'Hassan Ali',   initials: 'HA', color: 5, role: 'Sales',     tz: 'GMT' },
  { id: 'u7', name: 'Lin Wei',      initials: 'LW', color: 6, role: 'Support',   tz: 'SGT' },
  { id: 'u8', name: 'Kai Holm',     initials: 'KH', color: 7, role: 'Marketing', tz: 'CET' },
];
const userById = (id) => MEMBERS.find(m => m.id === id);

const PROJECT_TYPES = {
  engineering: {
    id: 'engineering', label: 'Engineering', accent: 'engineering',
    iconKey: 'Code',
    blurb: 'Ship software in sprints — epics, tasks, kanban, burndown.',
    hierarchy: 'Epic → Task → Subtask',
    mainView: 'Sprint Kanban',
    vocab: { item: 'Task', items: 'Tasks', parent: 'Epic', parents: 'Epics', board: 'Sprint Board', extra: ['Backlog', 'Burndown'] },
    statuses: ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done', 'Blocked'],
    tags: ['Sprints', 'Backlog', 'CI/CD'],
  },
  sales: {
    id: 'sales', label: 'Sales', accent: 'sales',
    iconKey: 'Sales',
    blurb: 'Close deals — accounts, leads, pipeline by stage.',
    hierarchy: 'Account → Lead → Deal',
    mainView: 'Pipeline',
    vocab: { item: 'Deal', items: 'Deals', parent: 'Account', parents: 'Accounts', board: 'Pipeline', extra: ['Forecast', 'Activities'] },
    statuses: ['Prospect', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    tags: ['Pipeline', 'Forecast', 'CRM'],
  },
  support: {
    id: 'support', label: 'Support', accent: 'support',
    iconKey: 'Support',
    blurb: 'Resolve tickets — queues, customer threads, SLAs.',
    hierarchy: 'Customer → Ticket',
    mainView: 'Queue',
    vocab: { item: 'Ticket', items: 'Tickets', parent: 'Customer', parents: 'Customers', board: 'Queue', extra: ['SLA timers'] },
    statuses: ['New', 'Open', 'Pending', 'On Hold', 'Resolved', 'Closed'],
    tags: ['Queues', 'SLA', 'CSAT'],
  },
  marketing: {
    id: 'marketing', label: 'Marketing', accent: 'marketing',
    iconKey: 'Marketing',
    blurb: 'Run campaigns — assets, content calendar, channel mix.',
    hierarchy: 'Campaign → Asset → Task',
    mainView: 'Content Calendar',
    vocab: { item: 'Asset', items: 'Assets', parent: 'Campaign', parents: 'Campaigns', board: 'Calendar', extra: ['Channel mix'] },
    statuses: ['Idea', 'Drafting', 'In Review', 'Scheduled', 'Published'],
    tags: ['Campaigns', 'Calendar', 'Brand'],
  },
  operations: {
    id: 'operations', label: 'Operations', accent: 'ops',
    iconKey: 'Ops',
    blurb: 'Run repeatable processes — workflows, runs, checklists.',
    hierarchy: 'Workflow → Run → Checklist',
    mainView: 'Runbook',
    vocab: { item: 'Run', items: 'Runs', parent: 'Workflow', parents: 'Workflows', board: 'Runbook', extra: ['Recurrence'] },
    statuses: ['Scheduled', 'Running', 'Complete', 'Failed'],
    tags: ['Runbooks', 'Recurrence', 'SOPs'],
  },
  generic: {
    id: 'generic', label: 'Generic', accent: 'generic',
    iconKey: 'Generic',
    blurb: 'Lightweight project — list and simple board.',
    hierarchy: 'List → Task',
    mainView: 'Board',
    vocab: { item: 'Task', items: 'Tasks', parent: 'List', parents: 'Lists', board: 'Board', extra: [] },
    statuses: ['Todo', 'Doing', 'Done'],
    tags: ['Tasks', 'Board'],
  },
};

const PROJECTS = [
  { id: 'p_apollo',   name: 'Apollo — Mobile Onboarding',     type: 'engineering', icon: 'AP', lead: 'u2', members: ['u1','u2','u3','u4','u5'], health: 84, progress: 62, due: 'Aug 14', status: 'on-track', ai: 'autopilot' },
  { id: 'p_orbital',  name: 'Orbital Q3 Outbound',            type: 'sales',       icon: 'OB', lead: 'u6', members: ['u6','u1','u8'],             health: 67, progress: 41, due: 'Sep 30', status: 'at-risk', ai: 'suggest' },
  { id: 'p_relay',    name: 'Relay — Customer Support',       type: 'support',     icon: 'RL', lead: 'u7', members: ['u7','u3','u4'],             health: 91, progress: 75, due: 'ongoing', status: 'on-track', ai: 'suggest' },
  { id: 'p_canopy',   name: 'Canopy Spring Brand Refresh',    type: 'marketing',   icon: 'CN', lead: 'u8', members: ['u8','u5','u1'],             health: 78, progress: 48, due: 'Jul 22', status: 'on-track', ai: 'autopilot' },
  { id: 'p_loom',     name: 'Loom — Internal Tooling',        type: 'engineering', icon: 'LM', lead: 'u2', members: ['u2','u3','u4'],             health: 72, progress: 35, due: 'Oct 11', status: 'on-track', ai: 'ask' },
  { id: 'p_audit',    name: 'SOC 2 Audit Workflow',           type: 'operations',  icon: 'SA', lead: 'u1', members: ['u1','u3','u7'],             health: 88, progress: 81, due: 'Aug 01', status: 'on-track', ai: 'off' },
  { id: 'p_intake',   name: 'Q3 Hiring Pipeline',             type: 'generic',     icon: 'HP', lead: 'u1', members: ['u1','u5'],                   health: 70, progress: 30, due: 'Sep 12', status: 'on-track', ai: 'suggest' },
];

const projectById = (id) => PROJECTS.find(p => p.id === id);

// === ENGINEERING TASKS ====================================
const SPRINT = {
  id: 's24', name: 'Sprint 24', daysLeft: 6, capacity: 42, planned: 38, completed: 24,
  burndown: [38, 36, 33, 30, 28, 26, 24, 20, 17, 14, 10, 6, 2],
};

const EPICS = [
  { id: 'EP-1', name: 'Passwordless auth',   color: 'violet', lead: 'u2', members: ['u2','u3'],    target: 'Aug 14', status: 'On track',   desc: 'Magic-link, token flows, SSO fallback. Replaces password-based login across web + iOS.' },
  { id: 'EP-2', name: 'Onboarding redesign', color: 'info',   lead: 'u5', members: ['u5','u3'],    target: 'Aug 21', status: 'On track',   desc: 'New welcome flow, analytics events, empty-state illustration system. Targets 25% activation lift.' },
  { id: 'EP-3', name: 'Notification center', color: 'amber',  lead: 'u3', members: ['u3','u4'],    target: 'Sep 04', status: 'At risk',    desc: 'Preferences UI, realtime read-receipts, swipe-to-archive. Blocked on push infra spike.' },
  { id: 'EP-4', name: 'Telemetry & insights', color: 'teal',  lead: 'u2', members: ['u2','u4'],    target: 'Sep 18', status: 'Not started', desc: 'Activation funnel events, retention dashboard, error budgets for onboarding flow.' },
];

const TASKS = [
  { id: 'APL-241', title: 'Magic-link email template + retry logic', epic: 'EP-1', status: 'In Progress', priority: 'high',  assignee: 'u3', est: 5, comments: 4, attach: 2, branch: 'feat/magic-link' },
  { id: 'APL-242', title: 'Token expiry edge cases',                   epic: 'EP-1', status: 'In Review',   priority: 'medium',assignee: 'u4', est: 3, comments: 2, attach: 0, branch: 'feat/token-edge' },
  { id: 'APL-243', title: 'Welcome screen carousel motion',             epic: 'EP-2', status: 'In Progress', priority: 'medium',assignee: 'u5', est: 5, comments: 7, attach: 3 },
  { id: 'APL-244', title: 'Onboarding analytics events',                epic: 'EP-2', status: 'Todo',        priority: 'low',   assignee: 'u3', est: 2, comments: 0, attach: 0 },
  { id: 'APL-245', title: 'Push notification preferences UI',           epic: 'EP-3', status: 'Done',        priority: 'medium',assignee: 'u4', est: 3, comments: 5, attach: 1 },
  { id: 'APL-246', title: 'SSO error mapping for enterprise',           epic: 'EP-1', status: 'Blocked',     priority: 'urgent',assignee: 'u2', est: 8, comments: 11,attach: 2 },
  { id: 'APL-247', title: 'Empty-state illustration system',            epic: 'EP-2', status: 'Todo',        priority: 'low',   assignee: 'u5', est: 3, comments: 1, attach: 4 },
  { id: 'APL-248', title: 'Realtime read-receipts contract',            epic: 'EP-3', status: 'In Progress', priority: 'high',  assignee: 'u3', est: 8, comments: 9, attach: 1, branch: 'feat/read-receipts' },
  { id: 'APL-249', title: 'Mobile gesture: swipe-to-archive',           epic: 'EP-3', status: 'In Review',   priority: 'medium',assignee: 'u4', est: 5, comments: 3, attach: 0 },
  { id: 'APL-250', title: 'Audit log retention policy',                 epic: 'EP-1', status: 'Done',        priority: 'low',   assignee: 'u2', est: 2, comments: 0, attach: 0 },
  { id: 'APL-251', title: 'Migrate sessions to JWT v2',                 epic: 'EP-1', status: 'Todo',        priority: 'high',  assignee: 'u3', est: 8, comments: 2, attach: 0 },
  { id: 'APL-252', title: 'Splash skeleton loaders',                    epic: 'EP-2', status: 'Done',        priority: 'low',   assignee: 'u5', est: 1, comments: 1, attach: 0 },
];

// === SALES DEALS ==========================================
const DEAL_STAGES = [
  { id: 'prospect',    name: 'Prospect',     hue: 'hsl(220 10% 60%)' },
  { id: 'qualified',   name: 'Qualified',    hue: 'hsl(195 85% 50%)' },
  { id: 'proposal',    name: 'Proposal',     hue: 'hsl(217 91% 60%)' },
  { id: 'negotiation', name: 'Negotiation',  hue: 'hsl(28 92% 55%)'  },
  { id: 'won',         name: 'Closed Won',   hue: 'hsl(160 65% 42%)' },
];

const DEALS = [
  { id: 'D-118', name: 'Series A platform license', company: 'Northwind Capital', stage: 'prospect',    amount: 48000,  owner: 'u6', close: '2026-08-22', activity: 'Cold email replied', icon: 'NW' },
  { id: 'D-119', name: 'Compliance suite — 50 seats', company: 'Vector Bank',     stage: 'prospect',    amount: 62000,  owner: 'u6', close: '2026-09-04', activity: 'Discovery scheduled', icon: 'VB' },
  { id: 'D-120', name: 'Enterprise expansion',       company: 'Helix Health',     stage: 'qualified',   amount: 124000, owner: 'u6', close: '2026-08-30', activity: 'Demo last Tue',       icon: 'HX' },
  { id: 'D-121', name: 'Replace legacy CRM',         company: 'Lyric Studio',     stage: 'qualified',   amount: 38000,  owner: 'u1', close: '2026-09-14', activity: 'Champion identified', icon: 'LS' },
  { id: 'D-122', name: 'Annual renewal + add-on',    company: 'Cobalt Logistics', stage: 'proposal',    amount: 215000, owner: 'u6', close: '2026-08-09', activity: 'Quote sent Mon',      icon: 'CL' },
  { id: 'D-123', name: '3-year multi-product',       company: 'Beacon Energy',    stage: 'proposal',    amount: 480000, owner: 'u1', close: '2026-09-01', activity: 'Awaiting legal',      icon: 'BE' },
  { id: 'D-124', name: 'Mid-market base + analytics',company: 'Tidepool',         stage: 'negotiation', amount: 86000,  owner: 'u6', close: '2026-08-12', activity: 'Pricing pushback',    icon: 'TP' },
  { id: 'D-125', name: 'Pilot → production',         company: 'Quill Press',      stage: 'negotiation', amount: 32000,  owner: 'u8', close: '2026-08-04', activity: 'Final terms',         icon: 'QP' },
  { id: 'D-126', name: 'Standard tier renewal',      company: 'Orbit Studios',    stage: 'won',         amount: 24000,  owner: 'u6', close: '2026-07-29', activity: 'Signed',              icon: 'OS' },
  { id: 'D-127', name: 'Department-wide rollout',    company: 'Pine & Co.',       stage: 'won',         amount: 156000, owner: 'u1', close: '2026-07-15', activity: 'Onboarding kickoff',  icon: 'PC' },
];

// === SUPPORT TICKETS ======================================
const TICKETS = [
  { id: 'T-1429', subject: 'Cannot reset password — magic link never arrives', customer: 'Sara Lin · Helix Health',     priority: 'urgent', status: 'Open',     sla: '0:24', slaState: 'danger', assignee: 'u7', updated: '4m ago' },
  { id: 'T-1428', subject: 'Webhook payload missing signature header',         customer: 'Drew Patel · Northwind',       priority: 'high',   status: 'Open',     sla: '1:08', slaState: 'warn',   assignee: 'u7', updated: '11m ago' },
  { id: 'T-1427', subject: 'Export to CSV truncates at 10k rows',              customer: 'Mira Soto · Vector Bank',      priority: 'medium', status: 'Pending',  sla: '3:42', slaState: 'ok',     assignee: 'u3', updated: '22m ago' },
  { id: 'T-1426', subject: 'SSO loop after Okta config change',                customer: 'James Ho · Beacon Energy',      priority: 'urgent', status: 'Open',     sla: '0:48', slaState: 'danger', assignee: 'u7', updated: '32m ago' },
  { id: 'T-1425', subject: 'Mobile app crash on iOS 18 — comments tab',        customer: 'Alex Bell · Tidepool',          priority: 'high',   status: 'Open',     sla: '2:15', slaState: 'warn',   assignee: 'u4', updated: '48m ago' },
  { id: 'T-1424', subject: 'Question about timezone handling in roadmap',       customer: 'Mei Tanaka · Pine & Co.',       priority: 'low',    status: 'Pending',  sla: '7:30', slaState: 'ok',     assignee: 'u7', updated: '1h ago' },
  { id: 'T-1423', subject: 'Integration with Slack — channel mapping',          customer: 'Joel Knight · Lyric Studio',    priority: 'medium', status: 'Open',     sla: '4:02', slaState: 'ok',     assignee: 'u3', updated: '2h ago' },
  { id: 'T-1422', subject: 'Billing — annual invoice should consolidate',       customer: 'Yara Aziz · Cobalt Logistics',  priority: 'medium', status: 'On Hold',  sla: '—',    slaState: 'ok',     assignee: 'u1', updated: '3h ago' },
];

// === MARKETING ASSETS / CALENDAR ==========================
const ASSETS = [
  // Each: { day(0-based offset in current month grid), type, title, owner, campaign, channel }
  { day: 3,  type: 'blog',   title: 'Why we rebuilt onboarding',      owner: 'u8', campaign: 'Spring Brand' },
  { day: 4,  type: 'social', title: 'Teaser carousel — IG',           owner: 'u5', campaign: 'Spring Brand' },
  { day: 6,  type: 'email',  title: 'Beta invite — wave 2',           owner: 'u8', campaign: 'Apollo Launch' },
  { day: 8,  type: 'blog',   title: 'How AI plans your sprints',      owner: 'u8', campaign: 'Apollo Launch' },
  { day: 10, type: 'ad',     title: 'LinkedIn paid — PMs',            owner: 'u5', campaign: 'Apollo Launch' },
  { day: 11, type: 'social', title: 'Founder thread',                 owner: 'u8', campaign: 'Spring Brand' },
  { day: 13, type: 'email',  title: 'Customer story — Helix',         owner: 'u1', campaign: 'Spring Brand' },
  { day: 15, type: 'event',  title: 'Webinar: AI-native PMO',         owner: 'u8', campaign: 'Apollo Launch' },
  { day: 16, type: 'social', title: 'Webinar clip × 3',               owner: 'u5', campaign: 'Apollo Launch' },
  { day: 18, type: 'blog',   title: 'Sprint 24 retro public post',    owner: 'u8', campaign: 'Spring Brand' },
  { day: 19, type: 'ad',     title: 'Retargeting — engineering ICP',  owner: 'u5', campaign: 'Apollo Launch' },
  { day: 21, type: 'email',  title: 'Newsletter — July edition',      owner: 'u8', campaign: 'Spring Brand' },
  { day: 23, type: 'event',  title: 'Office hours — APAC',            owner: 'u7', campaign: 'Spring Brand' },
  { day: 25, type: 'social', title: 'Customer love roundup',          owner: 'u5', campaign: 'Spring Brand' },
  { day: 26, type: 'blog',   title: 'Roadmap update post',            owner: 'u8', campaign: 'Apollo Launch' },
];

// === AI INBOX SUGGESTIONS =================================
const AI_FEED = [
  {
    id: 'ai1', kind: 'replan', urgency: 'high',
    when: '12m ago', project: 'p_apollo',
    title: 'Sprint 24 velocity 22% below trailing average',
    body: 'At current pace, APL-246 and APL-251 will spill into Sprint 25. I drafted three options.',
    suggestions: [
      { label: 'Cut APL-251 from Sprint 24 (–8 pts)', primary: true },
      { label: 'Move APL-246 dependencies up' },
      { label: 'Add Maya part-time (+5 pt capacity)' },
    ],
    reason: 'Based on burndown slope · 12 historical sprints',
  },
  {
    id: 'ai2', kind: 'risk', urgency: 'medium',
    when: '1h ago', project: 'p_orbital',
    title: 'Cobalt Logistics deal stalled 9 days in Proposal',
    body: 'No activity since Aug 2. Median time-in-stage for deals this size is 4 days. Worth a nudge.',
    suggestions: [ { label: 'Draft check-in email', primary: true }, { label: 'Slack #cobalt-deal' } ],
    reason: 'Historical pipeline data · pattern match',
  },
  {
    id: 'ai3', kind: 'insight', urgency: 'low',
    when: '3h ago', project: 'p_relay',
    title: 'Week recap — Customer Support',
    body: '36 tickets · 92% within SLA · CSAT 4.7 · 2 escalations. Recurring: Okta SSO loop (4×).',
    suggestions: [ { label: 'Open recurring-issue draft', primary: true } ],
    reason: 'Weekly digest',
  },
  {
    id: 'ai4', kind: 'meeting', urgency: 'low',
    when: 'Yesterday', project: 'p_apollo',
    title: 'Apollo standup → 4 action items',
    body: 'Transcribed standup with Aria, Theo, Maya. I drafted 4 tasks and updated APL-243 status.',
    suggestions: [ { label: 'Review drafted tasks', primary: true } ],
    reason: 'Meeting transcript · "Apollo standup"',
  },
];

window.MOCK = {
  ORGS, MEMBERS, userById,
  PROJECT_TYPES, PROJECTS, projectById,
  SPRINT, EPICS, TASKS,
  DEAL_STAGES, DEALS,
  TICKETS,
  ASSETS,
  AI_FEED,
};
