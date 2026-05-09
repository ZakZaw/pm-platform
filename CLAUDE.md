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
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/                 # ← DESIGN SYSTEM (the single source of truth for all UI)
│   │   │       ├── Button/
│   │   │       │   ├── Button.jsx
│   │   │       │   └── Button.css
│   │   │       ├── Input/
│   │   │       ├── Badge/
│   │   │       ├── Card/
│   │   │       ├── Modal/
│   │   │       ├── Avatar/
│   │   │       ├── Dropdown/
│   │   │       ├── Tooltip/
│   │   │       ├── Spinner/
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

## CSS Strategy (No Tailwind)

All styling uses **CSS custom properties (tokens) + scoped component CSS**. This is the equivalent of a design system.

### Tokens (`src/styles/tokens.css`)

Every visual value lives here. Never hardcode colors, spacing, or font sizes anywhere else.

```css
:root {
  /* Colors */
  --color-primary: #5B6AF0;
  --color-primary-hover: #4A59E0;
  --color-danger: #E0474C;
  --color-success: #27AE60;
  --color-warning: #F39C12;

  --color-bg: #0F1117;
  --color-bg-secondary: #181C27;
  --color-bg-elevated: #1E2235;
  --color-border: #2A2F45;

  --color-text: #E8EAF2;
  --color-text-secondary: #8B91A8;
  --color-text-muted: #545870;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography */
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'Fira Code', monospace;

  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-md: 15px;
  --text-lg: 17px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 14px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;
}
```

### Component CSS Pattern

Each component has its own `.css` file. Classes use BEM-ish naming scoped to the component.

```css
/* Button.css */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--transition-fast);
  cursor: pointer;
  border: none;
}

.btn--primary {
  background: var(--color-primary);
  color: #fff;
}
.btn--primary:hover { background: var(--color-primary-hover); }

.btn--ghost { background: transparent; color: var(--color-text); }
.btn--ghost:hover { background: var(--color-bg-elevated); }

.btn--danger { background: var(--color-danger); color: #fff; }
.btn--sm { padding: var(--space-1) var(--space-3); font-size: var(--text-xs); }
.btn--lg { padding: var(--space-3) var(--space-6); font-size: var(--text-md); }
```

### The Golden Rule for Components

**Every shared UI primitive lives in `/src/components/ui/` and is exported from its `index.js`.**
Pages and feature components import from there — never duplicate a primitive.

```js
// components/ui/index.js
export { Button } from './Button/Button';
export { Input } from './Input/Input';
export { Badge } from './Badge/Badge';
export { Modal } from './Modal/Modal';
export { Avatar } from './Avatar/Avatar';
export { Card } from './Card/Card';
// ... etc

// Usage anywhere in the app:
import { Button, Badge, Avatar } from '@/components/ui';
```

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
- Do not write inline styles. All styles go through tokens + component CSS.
- Do not duplicate UI primitives. If it doesn't exist in `ui/`, create it there first.
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

**Phase 0 — Foundation** (not started)

Next task: Set up Docker Compose so all three services start and the API can talk to PostgreSQL.
Check `ROADMAP.md` for the full ordered task list.
