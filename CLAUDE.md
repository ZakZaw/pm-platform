# CLAUDE.md — Project Context for Claude Code

This file is the single source of truth for how this codebase works.
Read this before writing any code, creating any file, or making any architectural decision.

---

## Project Overview

**What it is:** A project management SaaS platform — a unified workspace for engineering, product, sales, and support teams. AI-native: it plans projects, decomposes work, takes meeting notes, and keeps roadmaps in sync with reality.

**Design document:** `docs/platform_design_document_full.docx` (full specs, ER diagram, BRD, user flows, state machines)

**Roadmap:** `ROADMAP.md` (feature list phased Alpha → Beta → GA)

---

## Tech Stack

| Layer            | Technology                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Backend          | .NET 10 Web API (Clean Architecture)                                                              |
| Frontend         | React 19 + Vite                                                                                   |
| Database         | PostgreSQL 16                                                                                     |
| ORM              | Entity Framework Core 9                                                                           |
| Containerisation | Docker + Docker Compose                                                                           |
| CSS              | CSS custom properties (design tokens) — **no Tailwind**                                           |
| Auth             | JWT (access + refresh tokens)                                                                     |
| Real-time        | SignalR (WebSocket)                                                                               |
| AI               | Google Gemini API for dev (free tier), Anthropic Claude for production. Called from backend only. |
| Video            | LiveKit or Daily.co (managed WebRTC — do not build raw WebRTC)                                    |
| Testing          | xUnit (.NET), Vitest (React)                                                                      |

---

## Repository Structure

```
/
├── backend/
│   ├── src/
│   │   ├── Api/                    # .NET Web API project (controllers, middleware, DI)
│   │   ├── Application/            # Use cases, CQRS commands/queries, DTOs, interfaces
│   │   ├── Domain/                 # Entities, value objects, domain events, enums
│   │   └── Infrastructure/         # EF Core, repositories, external services, AI client
│   ├── tests/
│   │   ├── Unit/
│   │   └── Integration/
│   └── backend.sln
│
├── New Design Files/               # ← Design system source of truth (mockups + canonical CSS/tokens)
│   ├── src/screens/                # one .jsx mockup per screen
│   ├── styles/                     # tokens.css · components.css · base.css · app.css
│   └── scrap/                      # in-progress sketches (not consumed by app)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                 # ← Stratos primitives, single source of truth for all UI
│   │   │       ├── Button/
│   │   │       │   ├── Button.jsx
│   │   │       │   └── Button.css
│   │   │       ├── Input/
│   │   │       ├── Select/
│   │   │       ├── Card/
│   │   │       ├── Avatar/
│   │   │       ├── AvatarStack/
│   │   │       ├── Badge/          # Stratos tones (neutral/info/purple/warning/danger/success)
│   │   │       ├── StatusBadge/    # task-status pill
│   │   │       ├── Priority/       # urgent/high/med/low bars
│   │   │       ├── Sparkline/      # compact line chart for sprint banner + KPI tiles
│   │   │       ├── AIChip/         # gradient + soft variants
│   │   │       ├── Chip/
│   │   │       ├── Modal/
│   │   │       ├── Dropdown/       # uses .menu / .menu-item / .menu-section
│   │   │       ├── AssigneePicker/
│   │   │       ├── Spinner/
│   │   │       ├── Table/
│   │   │       ├── Tooltip/
│   │   │       ├── Toast/
│   │   │       ├── Icon/           # kebab-case lucide-react wrapper (explicit REGISTRY for tree-shaking)
│   │   │       └── index.js        # Re-exports every UI component
│   │   │
│   │   ├── components/
│   │   │   ├── layout/             # AppShell, Sidebar, Topbar, PageWrapper
│   │   │   ├── tasks/              # TaskCard, TaskDetail, TaskForm, StatusBadge
│   │   │   ├── kanban/             # KanbanBoard, KanbanColumn, KanbanCard
│   │   │   ├── charts/             # BurndownChart, VelocityChart, HealthGauge, WorkloadHeatmap
│   │   │   ├── sprint/             # SprintBoard, SprintPlanning
│   │   │   ├── roadmap/            # RoadmapView, EpicBar, MilestoneMarker
│   │   │   ├── ai/                 # AISuggestionCard, AIChat, PlanningWizard
│   │   │   └── meetings/           # MeetingRoom, Transcript, TaskReflection
│   │   │
│   │   ├── pages/                  # Route-level page components
│   │   │   ├── auth/
│   │   │   ├── onboarding/
│   │   │   ├── dashboard/
│   │   │   ├── project/
│   │   │   └── settings/
│   │   │
│   │   ├── store/                  # Zustand stores (one per domain)
│   │   │   ├── authStore.js
│   │   │   ├── projectStore.js
│   │   │   ├── taskStore.js
│   │   │   └── uiStore.js
│   │   │
│   │   ├── hooks/                  # Custom React hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useTasks.js
│   │   │   └── useSignalR.js
│   │   │
│   │   ├── api/                    # API client layer
│   │   │   ├── client.js           # Axios instance (base URL, interceptors, token refresh)
│   │   │   ├── auth.api.js
│   │   │   ├── tasks.api.js
│   │   │   └── projects.api.js
│   │   │
│   │   ├── styles/
│   │   │   ├── tokens.css          # ← ALL design tokens (colors, spacing, typography, shadows)
│   │   │   ├── stratos.css         # ← Layout primitives + shell classes (.app, .app-sidebar, .app-topbar, .menu, .tabs, .hstack, …)
│   │   │   ├── reset.css
│   │   │   └── global.css          # imports the other three
│   │   │
│   │   ├── utils/                  # Pure utility functions (dates, formatting, etc.)
│   │   ├── constants/              # Enums, route paths, config values
│   │   └── main.jsx
│   │
│   ├── index.html
│   └── vite.config.js
│
├── docker-compose.yml
├── docker-compose.override.yml     # local dev overrides (volumes, ports)
├── .env.example
├── ROADMAP.md
├── CLAUDE.md                       # ← this file
└── docs/
    └── platform_design_document_full.docx
```

---

## Design System (No Tailwind)

The UI is token-based. Design-time reference artifacts (canonical tokens, every component variant, every screen mockup) live in **`/New Design Files/`** at the repo root — that folder is the source of truth when you have any visual question. The working code in `frontend/src/` mirrors it.

**Hard rules:**

- All styling uses **CSS custom properties (tokens) + scoped component CSS**. Never hardcode a color, spacing value, font size, radius, shadow, or duration anywhere in component CSS.
- Class naming is **flat** (`btn-primary`, `card-hover`, `badge-info`, `is-error`) — not BEM (`btn--primary`). State is expressed via separate state classes (`is-active`, `is-error`, `is-disabled`).
- The design supports both light (default) and dark themes via `[data-theme="dark"]`. New component CSS must always reference theme-aware tokens like `--bg`, `--surface`, `--text`, `--border`.

### Tokens (`frontend/src/styles/tokens.css`)

The single source of truth for visual values. Token families (matches `/New Design Files/styles/tokens.css` 1:1):

| Family       | Tokens                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces     | `--bg`, `--bg-subtle`, `--surface`, `--surface-2`, `--surface-hover`, `--surface-active`, `--overlay`, `--scrim`                        |
| Borders      | `--border`, `--border-strong`, `--border-subtle`, `--ring`, `--divider`                                                                 |
| Text         | `--text`, `--text-secondary`, `--text-muted`, `--text-subtle`, `--text-on-accent`, `--text-link`                                        |
| Accent       | `--accent`, `--accent-hover`, `--accent-active`, `--accent-bright`, `--accent-soft`, `--accent-soft-2`, `--accent-border`               |
| Status       | `--success` / `--warning` / `--danger` / `--info` / `--violet` / `--teal` / `--rose` / `--amber` (each with `-soft` and `-border`)      |
| Priority     | `--pri-urgent`, `--pri-high`, `--pri-medium`, `--pri-low`                                                                               |
| AI surface   | `--ai-1/2/3`, `--ai-gradient`, `--ai-gradient-soft`, `--ai-gradient-mid`, `--ai-text`, `--ai-border`, `--ai-glow`                       |
| Spacing      | `--s-0..13` (0/2/4/6/8/12/16/20/24/32/40/48/64/80 px)                                                                                   |
| Radius       | `--r-xs/sm/md/lg/xl/2xl`, `--r-pill`                                                                                                    |
| Shadows      | `--shadow-xs/sm/md/lg/xl`, `--shadow-pop`, `--shadow-inset`, `--shadow-accent`, `--shadow-focus`, `--shadow-focus-danger`               |
| Type sizes   | `--fs-2xs/xs/sm/md/base/lg/xl/2xl/3xl/4xl/5xl` (10..48 px)                                                                              |
| Type         | `--font-sans` (Plus Jakarta Sans), `--font-mono`, `--font-display` · `--fw-{regular,medium,semibold,bold}` · `--lh-{tight,snug,normal,relaxed}` · `--tracking-{tight,snug,normal,wide,mono}` |
| Motion       | `--ease-out`, `--ease-in-out`, `--ease-spring` · `--dur-{instant,fast,base,slow,slower}` (80/140/200/320/520 ms)                        |
| Layout       | `--sidebar-w` (248), `--sidebar-w-collapsed` (60), `--topbar-h` (56), `--drawer-w` (520), `--row-h` (40), `--content-max` (1440)        |
| Density      | `[data-density="compact"]` / `[data-density="spacious"]` override `--row-h` + `--s-6..10`                                               |
| Marketing    | `--mkt-channel-{email,social,blog,paid,event,other}` + `-bg` (per-channel chip colors)                                                  |

> **Legacy aliases:** the bottom of `tokens.css` still maps old token names (`--bg-app`, `--space-N`, `--font-size-h1`, `--radius-N`, `--text-primary`, etc.) to the new ones for any un-swept code paths. **Don't reference these in new code** — use the new vocabulary above. The aliases get removed once every callsite is on the new vocabulary.

### Component CSS Pattern

Each component lives in its own folder under `frontend/src/components/ui/<Name>/` with `<Name>.jsx` + `<Name>.css`. Classes are flat. Example:

```css
.btn {
  /* base */
}
.btn-sm { height: 28px; padding: 0 var(--s-4); font-size: var(--fs-sm); }
.btn-md { height: 34px; padding: 0 var(--s-5); font-size: var(--fs-md); }
.btn-lg { height: 42px; padding: 0 var(--s-7); font-size: var(--fs-base); }

.btn-primary {
  background: var(--accent);
  color: var(--text-on-accent);
  border-color: transparent;
  box-shadow: var(--shadow-sm), var(--shadow-inset);
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:active { background: var(--accent-active); }
```

### Primitives & component API

These are the canonical primitives. Build new ones in `frontend/src/components/ui/` and export them from `index.js` before using anywhere else.

| Primitive                                                                                                           | Variants / props                                                                                                                                    | Status |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `Button`                                                                                                            | `variant`: primary, secondary, ghost, danger, ai · `size`: sm, md, lg · `block`, `type`, `disabled`                                                 | ✅     |
| `Input`                                                                                                             | `label`, `error`, `help`, all native props                                                                                                          | ✅     |
| `Select`                                                                                                            | `label`, `error`, `help`, `options` or children                                                                                                     | ✅     |
| `Card`                                                                                                              | `variant`: default, elevated, ai · `title`, `subtitle`                                                                                              | ✅     |
| `Avatar`                                                                                                            | `name`, `src`, `size`: xs/sm/md/lg/xl · `color`: 1–8 · `status`: online/busy/away/offline                                                           | ✅     |
| `Badge`                                                                                                             | `tone`: neutral/info/purple/warning/danger/success · `dot`, children                                                                                | ✅     |
| `Priority`                                                                                                          | `level`: urgent/high/med/low (or Urgent/High/Medium/Low)                                                                                            | ✅     |
| `StatusBadge`                                                                                                       | `status`: Backlog/ToDo/InProgress/InReview/Blocked/Done/WontDo                                                                                      | ✅     |
| `Avatar`                                                                                                            | already shown — also has `Avatar` palette `av-1..8`                                                                                                 | ✅     |
| `AvatarStack`                                                                                                       | `people`, `max`, `size` — overlapped avatars with `+N` overflow                                                                                     | ✅     |
| `AIChip`                                                                                                            | `label`, `variant`: gradient / soft                                                                                                                 | ✅     |
| `Sparkline`                                                                                                         | `points`, `width`, `height`, `ideal`, `stroke` — compact line chart                                                                                 | ✅     |
| `Chip`                                                                                                              | small selectable pill (used for filters)                                                                                                            | ✅     |
| `Modal`                                                                                                             | `.modal-backdrop`, `.modal-header/body/footer`                                                                                                      | ✅     |
| `Dropdown`                                                                                                          | uses `.menu` / `.menu-item` / `.menu-section` / `.menu-divider` from `stratos.css`                                                                  | ✅     |
| `Tooltip`                                                                                                           | `.tooltip` with arrow                                                                                                                               | ✅     |
| `Toast`                                                                                                             | `.toast.toast-{success,danger,info}` · `useToast()` hook                                                                                            | ✅     |
| `AssigneePicker`                                                                                                    | searchable picker bound to org membership                                                                                                           | ✅     |
| `Spinner`                                                                                                           | inline loading indicator                                                                                                                            | ✅     |
| `Table`                                                                                                             | header + rows wrapper                                                                                                                               | ✅     |
| `Segmented`                                                                                                         | `value`, `onChange`, `options` (each `{ value, label, count?, disabled? }`), `size` (sm/md), `ariaLabel` — segmented control                        | ✅     |
| `Tabs` / `Tab`                                                                                                      | flat-class `.tabs > .tab.is-active` lives in `stratos.css`; wrap in a primitive when reused                                                         | ⏳     |
| `Icon`                                                                                                              | `name` (kebab-case), `size`, `color`, `strokeWidth` — explicit lucide-react REGISTRY for tree-shaking. Add to the registry when you use a new icon. | ✅     |
| **Chart widgets** (under `components/charts/`) — `BurndownChart`, `VelocityChart` (committed/completed bars + rolling-average overlay), `EpicProgressBars`, `HealthGauge`, `WorkloadHeatmap` | All accept token-styled props and render token-colored SVG/CSS bars (no recharts — see F2-26 note in ROADMAP); fed by the F2-26 analytics endpoints on the Dashboard + Sprint detail | ✅     |

```js
// components/ui/index.js
export { Button } from "./Button/Button";
export { Input } from "./Input/Input";
export { Select } from "./Select/Select";
export { Card } from "./Card/Card";
export { Avatar } from "./Avatar/Avatar";
// ... new primitives added here as they're built

// Usage anywhere in the app:
import { Button, Card, Avatar } from "@/components/ui";
```

### App frame & shared layout classes

The app shell uses flat layout classes directly (no component wrapper required). All of them live in `frontend/src/styles/stratos.css` — **reuse, don't recreate.** When you need a new pattern, search `/New Design Files/styles/components.css` first; only invent a class when nothing matches.

| Family      | Classes                                                                                                                                                                                                       | Notes                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Shell grid  | `.app` (`grid-template-rows: var(--topbar-h) 1fr` × `grid-template-columns: var(--sidebar-w) 1fr`) · `.app.is-collapsed` collapses to `--sidebar-w-collapsed` · `.sidebar` (spans both rows) · `.topbar` · `.main` | The shell is grid-based; sidebar spans both rows.                                                                          |
| Sidebar     | `.sidebar-org` + `.sidebar-logo` / `.sidebar-org-name` / `.sidebar-org-slug` · `.sidebar-scroll` · `.sidebar-section` + `.sidebar-label` · `.nav-item` / `.nav-item.is-active` + `.nav-icon` / `.nav-count` / `.ai-pulse` · `.sidebar-foot` + `.sidebar-foot-name` / `.sidebar-foot-mail` · `.proj-card` (project switcher card) | Sidebar collapses to icons via `.app.is-collapsed`.                                                                         |
| Topbar      | `.crumbs` + `.crumbs strong` / `.crumbs-sep` · `.search` (Cmd-K trigger) · `.kbd`                                                                                                                              | Breadcrumb is derived from the URL; `Topbar.jsx` owns the mapping.                                                          |
| Page chrome | `.main-inner` (page padding) · `.page-head` + `.page-title-row` / `.page-title` / `.page-subtitle` · `.eyebrow` (uppercase tertiary label above titles) · `.h-card` (card header text)                         | **Every page** uses `.main-inner` + `.page-head` + `.page-title-row` with `.eyebrow` / `.page-title` / `.page-subtitle`.    |
| Overlays    | `.menu` + `.menu-label` / `.menu-item` / `.menu-item.is-selected` / `.menu-item.is-danger` / `.menu-sep` · `.tabs` + `button.is-active` + `.tab-count` · `.ai-card` + `.ai-card-head` / `.ai-card-body` / `.ai-mark` (iridescent AI surface) · `.modal-scrim` + `.modal` + `.modal-header/body/footer` · `.drawer` + `.drawer-head` / `.drawer-body` / `.drawer-prop` + `.label-key` (work-item drawer pattern) | `Dropdown` renders `.menu`; `Modal` renders `.modal-scrim` + `.modal`; AI breakdowns use `.ai-card` + `.ai-mark`.            |
| Grid        | `.grid-12` (12-col) + `.col-3/4/6/8/12` (collapses at 1120 / 760 px breakpoints) · `.grid-4` (4-col responsive cards) · `.stat` + `.stat-label` / `.stat-value` / `.stat-row` / `.stat-delta-up` / `.stat-delta-down` (KPI tile) · `.proj-icon` + `.proj-icon-{engineering,sales,support,marketing,operations,generic}` (project-type tinted square) · `.seg` (segmented control — wrap with the `Segmented` primitive when reused) | Use the 12-col grid for dashboards and home pages; `.stat` for KPI strips; `.proj-icon` everywhere a project is identified. |
| Domain      | `.kanban` + `.kanban-col` + `.kanban-col-head/body` + `.card-task` (engineering board) · `.pipeline` + `.pipe-col` + `.deal-card` (sales) · `.queue` + `.queue-row` + `.sla` (support) · `.cal` + `.cal-cell` + `.cal-event.evt-{blog,email,social,event,ad}` (marketing) · `.tbl` (operations runbook table) · `.gantt` + `.gantt-head/row/bar/milestone` (roadmap) · `.type-pick` + `.type-pick-card` (project-type chooser) | One domain pattern per project type — they're already wired in `PipelinePage`, `QueuePage`, `ContentCalendarPage`, `RunbooksPage`. |
| Utility     | `.row` / `.col` / `.fill` / `.center` / `.between` · `.gap-1..8` (alias for `--s-2..9` gap) · `.muted` / `.mono` / `.truncate` · `.divider` / `.divider-v` · `.bar` + `.bar-fill` / `.bar-fill-{success,warning,danger,ai}` (progress bar) · `.cb` (styled checkbox) · `.spark` · `.priority` + `.priority-flag` | Inline flex helpers — prefer these over per-component layout CSS for one-off rows/stacks.                                   |

Open any **structurally rewritten** page for a live reference: `ProjectHomePage.jsx`, `OrgHomePage.jsx`, `DashboardPage.jsx`, `MyWorkPage.jsx`, `EpicsPage.jsx`, `BoardPage.jsx`, `PipelinePage.jsx`, `QueuePage.jsx`, `ContentCalendarPage.jsx`, `RunbooksPage.jsx`, `TaskDetail.jsx` — they all use the conventions above.

---

## Backend Architecture (.NET Clean Architecture)

```
Domain/
  Entities/           # Organization, User, Project, Task, Sprint, Epic, etc.
  Enums/              # TaskStatus, OrgRole, ProjectRole, EnvironmentType, etc.
  ValueObjects/       # StoryPoints, HealthScore, etc.
  Events/             # Domain events (TaskStatusChanged, SprintClosed, etc.)
  Interfaces/         # IRepository<T>, IUnitOfWork

Application/
  Features/           # One folder per feature (CQRS style)
    Tasks/
      Commands/       # CreateTask, UpdateTaskStatus, AssignTask
      Queries/        # GetTaskById, GetProjectTasks
    Sprints/
    AI/
  Common/             # Result<T>, MediatR behaviours, validation
  Interfaces/         # ICurrentUser, IAIService, IEmailService

Infrastructure/
  Persistence/        # AppDbContext, EF configurations, migrations
  Repositories/
  Services/
    AIService.cs      # Wraps Anthropic API calls
    EmailService.cs
    SignalRHub.cs
  ExternalAdapters/   # GitHub, Zendesk, HubSpot adapters

Api/
  Controllers/        # Thin controllers — call MediatR, return results
  Middleware/         # Auth, error handling, logging
  Program.cs
```

### API Conventions

- Controllers are thin: validate → send MediatR command → return result
- Return `Result<T>` from Application layer (no exceptions for business errors)
- All endpoints under `/api/v1/`
- Auth: Bearer JWT in `Authorization` header
- Errors return RFC 7807 `application/problem+json`

---

## Database

- **PostgreSQL 16** via EF Core Code-First
- Migrations live in `Infrastructure/Persistence/Migrations/`
- Run migrations: `dotnet ef database update` from `Infrastructure/`
- Schema clusters (from design doc):
  - Cluster 1: Org & Access (Organization, User, OrgMembership, Project, ProjectMembership, Team, TeamMembership)
  - Cluster 2: Project Work (Epic, Task, Subtask, Sprint, SprintTask, Comment, Attachment) — **Story was dropped in Phase 1 rework; tasks sit directly under epics. `StoryPoints` remains as a field on Task (it's a unit, not an entity link). Project has a 2–4 char `Key` (e.g. "AT"); Task has a per-project `KeyNum` (e.g. 247) — combined they form the human-friendly task ID "AT-247" returned as `key` on every task DTO.**
  - Cluster 3: AI & Events (AIAction, AIAuditLog, Notification, ActivityLog)
  - Cluster 4: Comms (Channel, ChannelMember, Message, Meeting, MeetingTranscript, ActionItem)

---

## Domain Rules to Enforce

**Task status transitions** are unrestricted as of 2026-05-18. Any
from→to pair is allowed. `TaskStatusTransition.EnsureValid` only enforces:

- No-op transitions (`from == to`) throw `Task.NoOpTransition`.
- Moving to `Blocked` or `WontDo` requires a non-empty reason
  (`Task.ReasonRequired`) — kept as an audit signal, not a transition gate.

**Roles:**

- Org-level: Owner / Admin / Member / Guest
- Project-level: PM / Team Lead / Contributor / Viewer
- A user has BOTH independently. Org role doesn't override project role.

**AI Control Modes** (per project):

- `Autopilot` — AI applies low-impact changes silently (always audit-logged)
- `Suggest` — AI drafts, user reviews cards (default)
- `AskMeFirst` — AI waits for explicit approval
- `Off` — no AI actions

---

## AI Integration

AI calls are made **only from the backend** (`Infrastructure/Services/AIService.cs`).

**Development:** Google Gemini (`gemini-2.0-flash`) via the `Google.GenAI` NuGet package. Free tier covers all dev usage.
**Production:** Anthropic Claude (`claude-sonnet-4-20250514`) via the `Anthropic.SDK` NuGet package.

The Application layer defines an `IAIService` interface. Only the Infrastructure implementation differs between dev and prod — nothing else in the codebase changes when you switch providers.

Key AI features (see `ROADMAP.md` for priority):

- Project generation from description → epics, tasks (with acceptance criteria as subtasks)
- Effort estimation with confidence scores
- Sprint retrospective generation
- Meeting transcript → action item extraction
- Daily digest posting to team channels
- Risk detection and replan options

All AI write actions must be logged in `AIAuditLog` with: trigger, before-state, after-state, approving user, timestamp.

---

## Real-time (SignalR)

SignalR hub at `/hubs/project`. Clients subscribe to their project rooms.

Events pushed to clients:

- `TaskUpdated` — any field change
- `TaskStatusChanged` — with new status and who changed it
- `SprintUpdated`
- `NewMessage` — chat
- `AISuggestion` — when AI generates a suggestion card
- `MeetingTranscriptChunk` — live transcript streaming

---

## Environment Variables

See `.env.example`. Never commit real secrets.

Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — min 256-bit random key
- `ANTHROPIC_API_KEY` — production only
- `GEMINI_API_KEY` — development AI provider, backend only, never sent to frontend
- `LIVEKIT_API_KEY` / `LIVEKIT_SECRET` — for video
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — OAuth
- `FRONTEND_URL` — for CORS and redirect URIs

---

## What NOT to Do

- Do not call the Anthropic API from the frontend. Backend only.
- Do not write inline styles. All styles go through design tokens + component CSS in `/components/ui/` or `stratos.css`.
- Do not duplicate UI primitives. If it doesn't exist in `ui/`, create it there first — and match the mockup vocabulary in `/New Design Files/` (flat class names, theme-aware tokens).
- Do not recreate shell/layout classes (`.sidebar`, `.topbar`, `.main-inner`, `.page-head`, `.menu`, `.tabs`, `.row`, `.col`, `.crumbs`, etc.) inside page CSS. They live in `stratos.css` — import + use them.
- Do not hardcode colors, font sizes, spacing values, radii, shadows, or durations. Use the token (`var(--accent)`, `var(--s-6)`, `var(--fs-md)`, `var(--r-md)`, etc.). Hex codes in a component CSS file = bug.
- Do not use the **legacy** token aliases (`--bg-app`, `--text-primary`, `--space-N`, `--font-size-N`, `--radius-N`, `--weight-N`, `--leading-N`, `--prio-med`) in new code. They live at the bottom of `tokens.css` only for un-swept callsites and will be removed.
- Do not introduce a `Story` entity, table, or endpoint. Story was removed in the Phase 1 rework — tasks attach directly to epics, and `StoryPoints` stays as a unit field on `Task`.
- Do not put business logic in controllers. It goes in Application layer.
- Do not skip domain validation. Invalid task state transitions must be caught in Domain.
- Do not use `any` in TypeScript — the frontend should be typed (use JSDoc if not using TS).
- Do not build raw WebRTC. Use a managed provider (LiveKit/Daily.co).

---

## Running Locally (Windows CMD)

```cmd
:: Start Postgres + pgAdmin
docker-compose up -d

:: Backend (hot reload) — from backend\
dotnet watch run --project src\Api

:: Frontend (hot reload) — from frontend\
npm run dev

:: Apply DB migrations — from backend\
dotnet ef database update --project src\Infrastructure --startup-project src\Api

:: Run backend tests — from backend\
dotnet test

:: Run frontend tests — from frontend\
npm run test
```

---

## Current Phase

**Phase 1 + Phase 1.5 complete. Moving into Phase 2.**

- **F0** Foundation, **F1-01..F1-23** Core PM loop, and **F1.5-01..F1.5-08** Multi-Type Projects are shipped. The **Story entity was dropped** during the Phase 1 rework; tasks sit directly under epics, and the AC list on a task is rendered from subtasks. The AI generation wizard is wired end-to-end (Gemini in dev, Anthropic in prod).
- **Design refresh:** every page and primitive has been migrated to the new token vocabulary and mockup layouts under `/New Design Files/`. Token aliases at the bottom of `tokens.css` keep any un-swept callsites compiling but are scheduled for removal.
- **Phase 1.5 type-specific pages** (`PipelinePage`, `QueuePage`, `ContentCalendarPage`, `RunbooksPage`, `ListsPage`) all use the new shell and the per-type domain layouts (`.pipeline`, `.queue`, `.cal`, `.tbl`, `.kanban`).
- **Phase 2 entry points (`ROADMAP.md`)**: F2-01 (Roadmap timeline), F2-02 (List view), F2-03 (Calendar view), F2-04 (Dashboard customization), F2-07 (task enhancements). The visual scaffolding is ready — `.gantt`, `.tbl`, `.cal`, `.grid-12` cards, AI suggestion patterns. Backend gaps (activity-log feed, per-user notification queue, real-time hub for the new event types) are the gating work.
- **F2-26 First charts (shipped):** analytics live under `Application/Features/Analytics/` (`GetBurndownQuery`, `GetVelocityQuery`, `GetEpicProgressQuery`) + `AnalyticsController` (`api/v1/projects/{id}/analytics/{burndown,velocity,epic-progress}`). Burndown math is the pure, unit-tested `BurndownCalculator` and charts against the sprint **scope baseline** using `TaskStatusChange` history. Charts are token-styled SVG/CSS (`BurndownChart`, `VelocityChart` + rolling-avg overlay, `EpicProgressBars`) — **not recharts** (it's in `package.json` but unused; decide before adding more charts). The Engineering dashboard and Sprint detail consume these endpoints; remaining `sample`-chipped widgets (project health, team workload, weekly AI insight, most KPIs) are the next analytics gaps.

> **PMO positioning — a polishing/repositioning pass is planned before Phase 3.** This is a **PMO platform**, not just a PM app: the org/portfolio layer (cross-project rollups, per-type analytics, executive insight, resourcing across engineering/sales/support/marketing/ops) is the differentiator. Expect the next pass to polish existing flows and push the multi-type + org-level surfaces, **reshaping the Phase 3 list in `ROADMAP.md`**. Next analytics should be portfolio-level and type-appropriate (build on the `Analytics` feature folder established by F2-26). See the Phase 3 callout in `ROADMAP.md`.

Open any of these for the canonical pattern when you build a new page: `ProjectHomePage.jsx`, `OrgHomePage.jsx`, `DashboardPage.jsx`, `MyWorkPage.jsx`, `BoardPage.jsx`, `EpicsPage.jsx`, `PipelinePage.jsx`, `QueuePage.jsx`, `ContentCalendarPage.jsx`, `RunbooksPage.jsx`, `TaskDetail.jsx`.
