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

| Layer | Technology |
|---|---|
| Backend | .NET 10 Web API (Clean Architecture) |
| Frontend | React 19 + Vite |
| Database | PostgreSQL 16 |
| ORM | Entity Framework Core 9 |
| Containerisation | Docker + Docker Compose |
| CSS | CSS custom properties (design tokens) — **no Tailwind** |
| Auth | JWT (access + refresh tokens) |
| Real-time | SignalR (WebSocket) |
| AI | Google Gemini API for dev (free tier), Anthropic Claude for production. Called from backend only. |
| Video | LiveKit or Daily.co (managed WebRTC — do not build raw WebRTC) |
| Testing | xUnit (.NET), Vitest (React) |

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
├── Design Files/                   # ← STRATOS design system reference (mockups + canonical CSS)
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
│   │   │       ├── Badge/          # planned — Stratos tones (neutral/info/purple/warning/danger/success)
│   │   │       ├── StatusBadge/    # planned — task-status pill
│   │   │       ├── Priority/       # planned — urgent/high/med/low bars
│   │   │       ├── AIChip/         # planned
│   │   │       ├── Modal/          # planned
│   │   │       ├── Dropdown/       # planned (.menu)
│   │   │       ├── Tooltip/        # planned
│   │   │       ├── Toast/          # planned
│   │   │       ├── Icon/           # planned — lucide-react wrapper
│   │   │       └── index.js        # Re-exports every UI component
│   │   │
│   │   ├── components/
│   │   │   ├── layout/             # AppShell, Sidebar, Topbar, PageWrapper
│   │   │   ├── tasks/              # TaskCard, TaskDetail, TaskForm, StatusBadge
│   │   │   ├── kanban/             # KanbanBoard, KanbanColumn, KanbanCard
│   │   │   ├── sprint/             # SprintBoard, BurndownChart, SprintPlanning
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
│   │   │   ├── reset.css
│   │   │   └── global.css
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

## Design System — Stratos (No Tailwind)

The UI is built on **Stratos**, a token-based design system. Design-time reference artifacts (canonical tokens, every component variant, every screen mockup) live in `/Design Files/` at the repo root — that folder is the source of truth when you have any visual question. The working code in `frontend/src/` mirrors it.

**Hard rules:**

- All styling uses **CSS custom properties (tokens) + scoped component CSS**. Never hardcode a color, spacing value, font size, radius, shadow, or duration anywhere in component CSS.
- Class naming is **flat** (`btn-primary`, `card-elevated`, `badge-info`, `is-error`) — not BEM (`btn--primary`). State is expressed via separate state classes (`is-active`, `is-error`, `is-disabled`).
- Stratos supports both dark (default) and light themes via `[data-theme="light"]`. New component CSS must not assume dark — always reference theme-aware tokens like `--bg-base`, `--text-primary`, `--border-default`.

### Tokens (`frontend/src/styles/tokens.css`)

The single source of truth for visual values. Token families:

| Family | Examples |
|---|---|
| Surfaces | `--bg-app`, `--bg-base`, `--bg-surface-1/2/3`, `--bg-hover`, `--bg-selected`, `--bg-overlay` |
| Borders | `--border-subtle`, `--border-default`, `--border-strong`, `--border-focus` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--text-disabled`, `--text-on-accent`, `--text-inverse` |
| Accent | `--accent-primary`, `--accent-primary-hover`, `--accent-primary-active`, `--accent-primary-muted`, `--accent-primary-soft` |
| Color scales | `--indigo-50..950`, `--blue-50..950`, `--sky-50..900`, `--slate-50..950` |
| Status | `--status-{success,warning,danger,info,neutral,purple}` + `-bg` + `-border` |
| Priority | `--prio-urgent`, `--prio-high`, `--prio-med`, `--prio-low` |
| AI surface | `--ai-violet`, `--ai-cyan`, `--ai-pink`, `--ai-bg`, `--ai-border`, `--ai-glow` |
| Spacing | `--space-1..16` (4/8/12/16/20/24/32/40/48/64 px) |
| Radius | `--radius-xs/sm/md/lg/xl/2xl`, `--radius-pill` |
| Shadows | `--shadow-xs/sm/md/lg/xl`, `--shadow-focus`, `--shadow-focus-danger` |
| Type sizes | `--font-size-display/h1/h2/h3/h4/body/dense/meta` (30/24/20/17/15/14/13/11) |
| Type | `--font-ui`, `--font-mono`, `--weight-{regular,medium,semibold,bold}`, `--leading-{tight,snug,norm}` |
| Motion | `--dur-fast` (120 ms), `--dur-med` (220 ms), `--ease-out` |

### Component CSS Pattern

Each component lives in its own folder under `frontend/src/components/ui/<Name>/` with `<Name>.jsx` + `<Name>.css`. Classes are flat. Example:

```css
.btn { /* base */ }
.btn-sm { height: 24px; padding: 0 8px; font-size: var(--font-size-meta); }
.btn-md { height: 30px; padding: 0 12px; }
.btn-lg { height: 36px; padding: 0 16px; }

.btn-primary {
  background: var(--accent-primary);
  color: var(--text-on-accent);
  box-shadow: var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.12);
}
.btn-primary:hover:not(:disabled) { background: var(--accent-primary-hover); }
.btn-primary:active:not(:disabled) { background: var(--accent-primary-active); }
```

### Primitives & component API

These are the canonical primitives. Build new ones in `frontend/src/components/ui/` and export them from `index.js` before using anywhere else.

| Primitive | Variants / props | Status |
|---|---|---|
| `Button` | `variant`: primary, secondary, ghost, danger, ai · `size`: sm, md, lg · `block`, `type`, `disabled` | ✅ |
| `Input` | `label`, `error`, `help`, all native props | ✅ |
| `Select` | `label`, `error`, `help`, `options` or children | ✅ |
| `Card` | `variant`: default, elevated, ai · `title`, `subtitle` | ✅ |
| `Avatar` | `name`, `src`, `size`: xs/sm/md/lg/xl · `color`: 1–8 · `status`: online/busy/away/offline | ✅ |
| `Badge` | `tone`: neutral/info/purple/warning/danger/success · `dot`, `icon` | ⏳ build when first needed |
| `Priority` | `level`: urgent/high/med/low | ⏳ |
| `StatusBadge` | `status`: backlog/todo/in_progress/in_review/blocked/done | ⏳ |
| `AvatarStack` | `people`, `max`, `size` | ⏳ |
| `AIChip` | wraps "AI" with violet/cyan gradient pill | ⏳ |
| `Tabs` / `Tab` | flat-class `.tabs > .tab.is-active` | ⏳ |
| `Modal` | `.modal-backdrop`, `.modal-header/body/footer` | ⏳ |
| `Dropdown` / `Menu` | `.menu > .menu-item / .menu-section / .menu-divider` | ⏳ |
| `Tooltip` | `.tooltip` with arrow | ⏳ |
| `Toast` | `.toast.toast-{success,danger,info}` | ⏳ |
| `Icon` | thin wrapper over `lucide-react` | ⏳ |

```js
// components/ui/index.js
export { Button } from './Button/Button';
export { Input } from './Input/Input';
export { Select } from './Select/Select';
export { Card } from './Card/Card';
export { Avatar } from './Avatar/Avatar';
// ... new primitives added here as they're built

// Usage anywhere in the app:
import { Button, Card, Avatar } from '@/components/ui';
```

### App frame classes

The app shell uses Stratos layout classes directly (no component wrapper required): `.app` (grid 220px 1fr × 44px 1fr), `.app-sidebar`, `.app-topbar`, `.app-main`, `.page-header`. Sidebar items use `.side-item / .side-item.active`. Search the design files for any pattern you need before inventing one.

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
  - Cluster 2: Project Work (Epic, Story, Task, Subtask, Sprint, SprintTask, Comment, Attachment)
  - Cluster 3: AI & Events (AIAction, AIAuditLog, Notification, ActivityLog)
  - Cluster 4: Comms (Channel, ChannelMember, Message, Meeting, MeetingTranscript, ActionItem)

---

## Domain Rules to Enforce

**Task State Machine** (enforced in Domain, not just UI):

```
Backlog → To Do → In Progress → In Review → Done
                  In Progress → Blocked → In Progress
                  In Review → In Progress (changes requested)
                  Any → Won't Do
```

Invalid transitions must throw a `DomainException`.

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
- Project generation from description → epics, stories, tasks
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
- Do not write inline styles. All styles go through Stratos tokens + component CSS in `/components/ui/`.
- Do not duplicate UI primitives. If it doesn't exist in `ui/`, create it there first — and match the Stratos vocabulary in `/Design Files/` (flat class names, theme-aware tokens).
- Do not hardcode colors, font sizes, spacing values, radii, shadows, or durations. Use the token (`var(--accent-primary)`, `var(--space-4)`, etc.). Hex codes in a component CSS file = bug.
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

**Phase 1 — Core PM Loop** (in progress)

F0 (Foundation) is complete. F1-01 (Create org), F1-02 (Org roles) are committed. F1-03 (Invitations) is implemented locally, pending curl AC verification. Stratos design system was adopted mid-Phase-1: existing primitive CSS (Button, Input, Select, Card, Avatar) and all page CSS have been migrated to the Stratos token vocabulary and flat class naming.

Check `ROADMAP.md` for the full ordered task list and `/Design Files/` for the visual reference.
