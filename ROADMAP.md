# Project Management SaaS Platform — Development Roadmap

> Stack: .NET 10 · React + Vite · PostgreSQL · Docker
> Based on Design Document v1.0
> Design system: **Stratos** — tokens in `frontend/src/styles/tokens.css`; reference mockups, every component variant, every screen in `/Design Files/`. CLAUDE.md → "Design System — Stratos" has the canonical token/primitive reference.

Each task includes:

- **Backend:** API endpoints, entities, services
- **Frontend:** components, pages, state (always built on Stratos primitives from `components/ui/`)
- **AC:** acceptance criteria (done when…)

**Stratos primitive checklist.** When a task says "build a new UI primitive," it means adding it to `frontend/src/components/ui/<Name>/` matching the Stratos style (flat class names, theme-aware tokens), then exporting from `index.js`. Existing primitives: Button, Input, Select, Card, Avatar, Badge, StatusBadge, Priority, AIChip, AvatarStack, Sparkline, Chip, Modal, Dropdown, Toast, Tooltip, Table, AssigneePicker, Spinner. Still to build as features need them: Tabs (the `.tabs/.tab` classes already live in `stratos.css` — wrap them in a primitive when reused), Icon (a thin lucide-react wrapper).

**Stratos shell + layout classes.** The application chrome is built on the Stratos layout primitives in `frontend/src/styles/stratos.css`. **Reuse them — never invent new shell classes.** Key patterns: `.app` (grid 220px 1fr × 44px 1fr, `.is-collapsed` flips to 56px), `.app-sidebar` + `.org` / `.org-mark` / `.side-section` / `.side-item.is-active` / `.side-footer`, `.app-topbar` + `.crumb` / `.search-mini` / `.icon-btn` / `.divider-y`, `.app-main` + `.page-header` / `.page-title` / `.subsection`, `.menu` / `.menu-item` / `.menu-section` / `.menu-divider`, `.tabs` / `.tab.is-active`, `.hstack` / `.vstack` / `.grow` / `.mono` / `.truncate` / `.muted` / `.dim`, `.grid-2/3/4`, `.kbd`, `.card-ai`. Refer to `/Design Files/components.css` for the canonical CSS and `/Design Files/screen-*.jsx` for usage examples.

---

# Phase 0 — Foundation (Week 1–2)

**Goal:** All three services running, talking to each other. Auth works end-to-end. No business logic yet.

---

### F0-01 — Docker Compose: PostgreSQL + pgAdmin

**Backend:** `docker-compose.yml` with `db` and `pgadmin` services.
**Frontend:** none.
**AC:**

- `docker-compose up -d` starts both containers
- `docker ps` shows both healthy
- pgAdmin reachable at `localhost:5050`, can connect to the `db` service

---

### F0-02 — .NET 10 Clean Architecture skeleton

**Backend:** `Domain`, `Application`, `Infrastructure`, `Api` projects with proper reference chain. `Program.cs` builds and runs. Health check endpoint at `/health`.
**Frontend:** none.
**AC:**

- `dotnet build` succeeds with zero warnings
- `dotnet run --project src\Api` starts the API
- `GET /health` returns 200 OK
- `dotnet sln list` shows all 6 projects

---

### F0-03 — EF Core + PostgreSQL initial migration

**Backend:** `AppDbContext` in `Infrastructure/Persistence/`. Connection string via config. Initial empty migration created. `dotnet ef database update` applies it.
**Frontend:** none.
**AC:**

- `dotnet ef migrations add InitialCreate` succeeds
- `dotnet ef database update` creates the database
- pgAdmin shows the `__EFMigrationsHistory` table in the `pmplatform` database

---

### F0-04 — React + Vite scaffold + Stratos foundation

**Frontend:** Vite scaffold + the project folder structure. `tokens.css` holds the full Stratos token set (surfaces, borders, text, accents, status, priority, AI surface, spacing, radius, shadow, type, motion) with `[data-theme="light"]` overrides; `reset.css`, `global.css` in place. `main.jsx` imports `global.css`. The Stratos reference artifacts live in `/Design Files/` at the repo root and are the source of truth for any visual decision.
**AC:**

- `npm run dev` starts the dev server on port 5173
- The page renders with the dark background sourced from `--bg-app`
- Switching `<html data-theme="light">` flips surfaces/text without breaking layout
- All folders listed in `CLAUDE.md` exist

---

### F0-05 — JWT auth end-to-end

=[0]
**Backend:**

- `Domain/Entities/User.cs` (id, email, password_hash, full_name, created_at)
- `Application/Features/Auth/Commands/RegisterCommand.cs`, `LoginCommand.cs`, `RefreshTokenCommand.cs`
- `Infrastructure/Services/JwtService.cs`, `PasswordHasher.cs`
- `Api/Controllers/AuthController.cs` with `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`
- JWT middleware in `Program.cs`, `[Authorize]` attribute working

**Frontend:**

- `api/auth.api.js` (Axios calls)
- `store/authStore.js` (Zustand: user, accessToken, refreshToken, login, logout, register)
- `pages/auth/LoginPage.jsx`, `RegisterPage.jsx`
- `components/ui/Button`, `Input`, `Card` (first three UI primitives)
- Axios interceptor that attaches the Bearer token and auto-refreshes on 401

**AC:**

- Register a new user via the UI → row appears in `users` table
- Login → access + refresh token returned, stored in Zustand
- Visit a protected route while logged out → redirect to `/login`
- Token expires → next request silently refreshes, no logout

---

### F0-06 — App layout + routing

**Frontend:** `components/layout/AppShell.jsx` (sidebar + topbar + content area). Adopts the Stratos `.app` frame (grid: 220px 1fr × 44px 1fr) with `.app-sidebar`, `.app-topbar`, `.app-main`. React Router configured with public and protected routes.
**AC:**

- Logged in users see the AppShell with sidebar
- Logged out users get the auth pages with no shell
- Sidebar collapse works
- All `ui/` components used (no inline styles, no hardcoded colors)

---

### F0-07 — GitHub Actions CI

**Backend:** `.github/workflows/ci.yml` runs `dotnet build` + `dotnet test` on push and PR.
**Frontend:** same workflow runs `npm run build` + `npm run test`.
**AC:**

- A pushed commit triggers the workflow
- Workflow passes on a clean main branch
- Workflow fails if a test breaks

---

# Phase 1 — Alpha (Weeks 3–10)

**Goal:** AI generation loop works end-to-end. An internal user can sign up, create an org, type "I want to build a SaaS for tutors" and get a fully populated project with epics, stories, tasks, sprints, and a working Kanban board.

---

## 1A — Org & Team Foundation

### F1-01 (ORG-01) — Create & manage organization

**Backend:**

- Entities: `Organization` (id, name, slug, logo_url, plan, sso_enabled, created_at)
- `OrgMembership` (id, org_id, user_id, org_role, joined_at)
- Endpoints: `POST /api/v1/orgs`, `GET /api/v1/orgs/{slug}`, `PATCH /api/v1/orgs/{slug}`
- On org creation, the creating user automatically gets an `OrgMembership` with role `Owner`

**Frontend:**

- `pages/onboarding/CreateOrgPage.jsx`
- `components/ui/Avatar` (logo upload preview)
- After creation, redirect to `/{slug}/home`

**AC:**

- New user lands on Create Org after signup
- Slug uniqueness enforced (DB unique index)
- Creator becomes Owner automatically
- Org logo upload (image only, max 2 MB)

---

### F1-02 (ORG-03) — Org-level roles

**Backend:** `OrgRole` enum (Owner, Admin, Member, Guest). Permission attribute or policy on each endpoint:

- `RequireOrgRole(OrgRole.Admin)` — for protected actions
- Permissions per the design doc table (3.1.2)

**Frontend:**

- `hooks/useOrgRole.js` to read the current user's org role
- Conditionally render admin-only UI

**AC:**

- A Member trying to access "Configure SSO" gets 403
- An Owner can do everything in the permission table
- Role enforcement happens server-side, never trust the client

---

### F1-03 (ORG-02) — Invite members via email

**Backend:**

- Entity: `Invitation` (id, org_id, email, org_role, token, expires_at, accepted_at, created_by)
- Endpoint: `POST /api/v1/orgs/{slug}/invitations` (Admin+)
- Endpoint: `POST /api/v1/invitations/{token}/accept`
- Endpoint: `GET /api/v1/invitations/{token}` (preview before accepting)
- Email sending via SMTP (use Mailpit container in dev for local testing)
- Token = cryptographically random, 7-day expiry

**Frontend:**

- `pages/settings/MembersPage.jsx` — invite form (email + role select)
- `pages/auth/AcceptInvitePage.jsx` — `/invitations/:token` route
- New users go through register → auto-accept invite → join org

**AC:**

- Invitee receives email with the accept link
- Expired or used token shows error page
- Accepting creates `OrgMembership` with the invited role
- Existing user accepting → joins org without re-registering

---

### F1-04 (ORG-05) — Member profile

**Backend:** Add to `User`: `avatar_url`, `timezone`, `skill_tags` (text[]), `capacity_hours_per_week` (int).

- Endpoint: `PATCH /api/v1/users/me`

**Frontend:**

- `pages/settings/ProfilePage.jsx`
- Skill tags as multi-select chips — build a `Chip` primitive in `components/ui/Chip/` matching the Stratos badge styling (`.badge-neutral` + close affordance)
- Timezone dropdown using the existing `Select` primitive populated from `Intl.supportedValuesOf('timeZone')`

**AC:**

- User can edit all profile fields
- Skill tags stored as array, searchable later for AI assignment suggestions
- Timezone affects how dates display across the app (use `date-fns-tz`)

---

### F1-05 (ORG-07) — Org member directory

**Backend:** `GET /api/v1/orgs/{slug}/members` with pagination, search by name/email, filter by role.
**Frontend:**

- `pages/settings/MembersPage.jsx` table view (extend the existing invite form from F1-03)
- `components/ui/Table` — new Stratos primitive. Composition only (header + rows + cell), styled with `--bg-surface-1` rows, `--border-subtle` separators, `--font-size-dense` text. No sorting in this task — feature only.
- Search input (existing `Input`) + role filter (existing `Select`)
- Role chips per row use the planned `Badge` primitive (`badge-info` for Admin, `badge-purple` for Owner, `badge-neutral` for Member/Guest)

**AC:**

- All org members listed with role badges
- Owners + Admins can change a member's role
- Removing a member sets `OrgMembership.removed_at` (soft delete)

---

## 1B — Project Core

### F1-06 (PM-01) — Create project

**Backend:**

- Entities: `Project` (id, org_id, name, slug, environment_type, status, target_date, ai_control_mode, created_by)
- `ProjectMembership` (id, project_id, user_id, project_role)
- `EnvironmentType` enum (Developer, Support, Sales, Business)
- `ProjectRole` enum (PM, TeamLead, Contributor, Viewer)
- Endpoint: `POST /api/v1/orgs/{slug}/projects`
- Three creation modes: blank, template, ai-generate (the last one queues an AI job, see F1-15)

**Frontend:**

- `pages/project/CreateProjectPage.jsx`
- Three-card chooser: blank / template / ✨ AI generate
- On AI generate, route to `pages/project/AIGenerationWizard.jsx` (covered in F1-15)

**AC:**

- Creator becomes PM automatically
- Slug unique within org
- Environment type drives which integrations show up later

---

### F1-07 (PM-02) — Epic CRUD

**Backend:**

- Entity: `Epic` (id, project_id, title, description, owner_id, target_milestone_id, status, risk_flag, environment_type, color, created_at, archived_at)
- CRUD endpoints under `/api/v1/projects/{id}/epics`

**Frontend:**

- `components/epics/EpicCard.jsx`, `EpicForm.jsx`
- `pages/project/EpicsPage.jsx` — grid of epic cards

**AC:**

- PMs and Team Leads can create/edit/archive epics
- Epic shows progress % computed from child task story points
- Archived epics hidden by default, toggleable

---

### F1-08 (PM-03) — Task / Subtask CRUD

> **Phase 1 rework (2026-05):** The `Story` layer was removed. Tasks now sit directly under Epics; subtasks (used as acceptance criteria in the UI) sit under Tasks. Story-points stays as a Task field (it's a unit, not an entity link).

**Backend:**

- `Task` (id, project_id, epic_id, title, description, story_points, priority, status, sprint_id, assignee_id, reviewer_id, reporter_id, due_date, time_logged_minutes, pr_url, created_at)
- `Subtask` (id, task_id, title, completed, assignee_id) — rendered in the UI as acceptance criteria
- Priority enum: Low, Medium, High, Urgent
- Endpoints: full CRUD under `/api/v1/projects/{id}/tasks`, `/subtasks`

**Frontend:**

- `components/tasks/TaskCard.jsx` (compact, used everywhere)
- `components/tasks/TaskDetail.jsx` (drawer with all fields; two-column layout per `/Design Files/screen-task.jsx`)
- `components/tasks/TaskForm.jsx` (create/edit)
- `store/taskStore.js`

**AC:**

- Create epic → task → subtask hierarchy works
- Markdown supported in description (use `react-markdown`)
- @mentions in description trigger notifications (queue them now, ship in F2-XX)

---

### F1-09 (PM-04) — Task status state machine

**Backend:**

- `TaskStatus` enum (Backlog, ToDo, InProgress, InReview, Blocked, Done, WontDo)
- `TaskStatusTransition` value object that validates allowed transitions per the design doc 7.2 table
- Invalid transitions throw `DomainException` from the entity itself, not the controller
- Endpoint: `PATCH /api/v1/tasks/{id}/status` with `{ to: "...", reason?: "..." }`
- `Blocked` requires a reason; `WontDo` requires a reason

**Frontend:**

- Build the `StatusBadge` Stratos primitive in `components/ui/StatusBadge/`. Status→tone mapping (per `/Design Files/shared.jsx`): backlog→neutral·circle-dashed, todo→neutral·circle, in_progress→info·circle-dot, in_review→purple·git-pull-request, blocked→danger·octagon-x, done→success·circle-check. Wraps the planned `Badge` primitive.
- `components/tasks/StatusDropdown.jsx` — uses the planned `Dropdown/Menu` primitive; only shows valid next states based on current state
- API errors on bad transition surface as Stratos toasts (`Toast` primitive, `toast-danger` variant)

**AC:**

- All transitions in section 7.2 of the design doc work
- Invalid transitions return 422 with a clear error
- Status change is logged in `TaskStatusChange` audit table (created_at, from, to, by_user, reason)

---

### F1-10 (PM-05) — Kanban board

**Backend:** `GET /api/v1/projects/{id}/board?sprint_id=...&swimlane_by=assignee|epic|priority` returns columns with cards.
**Frontend:**

- `components/kanban/KanbanBoard.jsx`, `KanbanColumn.jsx`, `KanbanCard.jsx`
- Drag-drop with `@dnd-kit/core`
- Optimistic update + rollback on API error
- Swimlane toggle in board header

**AC:**

- Drag a card across columns → status updates in DB
- Drop fails on invalid transition → card snaps back, error toast shown
- Swimlanes group cards correctly
- Board updates in real-time (SignalR push, see F1-14)

---

### F1-11 (PM-06) — Backlog view

**Backend:** `GET /api/v1/projects/{id}/backlog` returns ordered list of tasks not in active sprint.
**Frontend:**

- `pages/project/BacklogPage.jsx`
- Drag tasks up/down to reorder priority
- Drag tasks into the right-hand "active sprint" panel to add to sprint

**AC:**

- Reordering persists `priority_order` in DB
- Capacity bar in active sprint panel updates live as tasks are added

---

### F1-12 (PM-07) — Sprint lifecycle

**Backend:**

- Entity: `Sprint` (id, project_id, name, goal, start_date, end_date, velocity_target, status, scope_baseline, created_at, closed_at)
- `SprintStatus` enum: Planning, Active, Closed
- `SprintTask` join table (id, sprint_id, task_id, added_at)
- Endpoints: `POST /api/v1/projects/{id}/sprints`, `POST /sprints/{id}/start`, `POST /sprints/{id}/close`
- Starting a sprint locks the scope baseline (snapshot of tasks + their points)
- Closing a sprint moves incomplete tasks to backlog, records final velocity

**Frontend:**

- `pages/project/SprintPlanningPage.jsx`
- Sprint header bar with name, dates, days remaining, goal

**AC:**

- Cannot start a sprint with zero tasks
- Cannot start a second sprint while one is active
- Closing prompts to confirm carryovers
- Velocity stored on close for chart use later

---

### F1-13 (PM-08) — Sprint board view

**Backend:** Filter the existing board endpoint by active sprint.
**Frontend:** `pages/project/SprintBoardPage.jsx` — reuses `KanbanBoard` with a sprint header. The header is the Stratos **sprint banner** from `/Design Files/screen-kanban.jsx`: name + date range badge, goal text, `Sparkline` burndown, `points X / Y` and `days left` KPIs, Filter + Add task buttons. `BoardPage` shares the same banner when an active sprint exists, falling back to the standard `.page-header` otherwise.
**AC:**

- Sprint goal banner shown at top with the four-KPI layout
- Days remaining countdown (warning color when ≤3)
- Inline burndown sparkline (real backend-fed series lands in Phase 2; Phase 1 derives a two-point projection from done vs total)

---

### F1-14 — SignalR real-time updates

**Backend:**

- `Infrastructure/Hubs/ProjectHub.cs` at `/hubs/project`
- Clients call `JoinProject(projectId)` on connect
- After any task/story write, server broadcasts `TaskUpdated` to the project group
- Use MediatR notification handlers to fire SignalR events from Application layer

**Frontend:**

- `hooks/useSignalR.js` connects on app mount, joins current project on route change
- Updates Zustand stores when events arrive

**AC:**

- Two browser tabs open on the same board → moving a card in tab A updates tab B within 1s
- Reconnect on disconnect (built into SignalR client)

---

### F1-15 (PM-09) — My Work view

**Backend:** `GET /api/v1/users/me/tasks?filter=today|week|overdue` across all projects user belongs to.
**Frontend:** `pages/dashboard/MyWorkPage.jsx` — three sections: Due Today, This Week, Overdue.
**AC:**

- Tasks span all projects the user is in
- Tasks grouped by project with project name as header
- Overdue tasks have a red indicator

---

### F1-16 (PM-14) — Custom workflow statuses

**Backend:** Allow project to define custom statuses on top of the core enum. Entity: `ProjectStatusConfig` (id, project_id, status_key, display_name, color, order, is_done_state).
**Frontend:** `pages/settings/WorkflowSettingsPage.jsx` — drag to reorder statuses, edit colors.
**AC:**

- Custom statuses appear as columns on the board
- At least one status must be marked `is_done_state`
- Existing tasks must be reassignable when a status is deleted

---

### F1-17 (PM-17) — Task comments and @mentions

**Backend:**

- Entity: `Comment` (id, task_id, author_id, body_md, mentioned_user_ids[], created_at, edited_at)
- Endpoints: full CRUD under `/api/v1/tasks/{id}/comments`
- @mentions parsed server-side from markdown
- Notification queued for each mentioned user (notification system in Phase 2)

**Frontend:**

- `components/tasks/CommentList.jsx`, `CommentInput.jsx`
- `@` triggers user search dropdown

**AC:**

- Comments show author avatar, time, edited indicator
- @mentions render as styled tags in the comment
- Comment author + PM can edit/delete

---

## 1C — AI Planning Loop (the core differentiator)

### F1-18 — IAIService abstraction

**Backend:**

- `Application/Interfaces/IAIService.cs` — methods like `GenerateProjectStructureAsync`, `EstimateStoryPointsAsync`, `SuggestAssigneeAsync`
- `Infrastructure/Services/Ai/GeminiAIService.cs` — implements `IAIService` using `Google.GenAI`
- All calls log request/response to `AIAuditLog` table (id, action_type, prompt, response, user_id, project_id, created_at, applied_by, before_state_json, after_state_json)
- Configurable system prompts per action type, stored in `Infrastructure/Services/Ai/Prompts/`

**Sample system prompt for project generation:**

> You are a senior project manager. Given a plain-language project description, output a JSON object with this exact schema: { "epics": [{ "title", "description", "color", "tasks": [{ "title", "description", "story_points", "priority", "acceptance_criteria": [...] }] }] }. Use 8 or fewer epics. Each task must be deliverable in a single sprint. Story points use Fibonacci scale (1, 2, 3, 5, 8, 13). Output ONLY valid JSON, no commentary.

**AC:**

- All AI calls go through `IAIService`, never directly to Gemini SDK from anywhere else
- Every AI write action creates a row in `AIAuditLog` (reversible within 24h)

---

### F1-19 (AI-01) — Project generation from plain description

**Backend:**

- Endpoint: `POST /api/v1/projects/generate` with `{ description, environment_type }`
- Flow: call `GenerateProjectStructureAsync` → parse JSON → create draft `ProjectGenerationRequest` row (status=draft) → return preview to user
- After user confirms via separate endpoint, write the full epic/story/task tree in a single transaction

**Frontend:**

- `pages/project/AIGenerationWizard.jsx` — three-step wizard (Describe → Clarify → Review & confirm) matching `/Design Files/screen-ai-wizard.jsx`: centered radial-gradient canvas, pill stepper with done/active dots and connector lines, prompt-recap card, `card-ai` generated-plan box with `TreeRow` rows (Badge + key + title + points + edit/remove icon-btns), ghosted previous-steps `grid-2` recap. Confirm button uses the Stratos `btn-ai` variant.
- Component: `components/ai/AISuggestionCard.jsx` — built on the Stratos `Card` primitive with `variant="ai"` (violet/cyan gradient border + glow + `--ai-bg` wash). The `AIChip` primitive already lives in `components/ui/AIChip/` and supports `variant="gradient"` and `variant="soft"`.

**AC:**

- Description → preview returns within 30 seconds
- Preview is fully editable before commit
- Confirm button creates the full project in <2s
- Cancel discards the draft
- All written entities have `created_by_ai = true` flag

---

### F1-20 (AI-02) — Clarification dialogue

**Backend:**

- Before generation, call AI with a `GenerateClarifyingQuestionsAsync` prompt → returns up to 3 questions
- Endpoint: `POST /api/v1/ai/clarify` with `{ description }` returns `{ questions: ["...", "...", "..."] }`
- User answers feed back into the main generation prompt

**Frontend:**

- Wizard step 2: show questions, allow skip ("Generate with assumptions")
- Skip → generation proceeds with original description only

**AC:**

- Questions are project-specific, not generic
- Skip works at any time
- Skipped runs are tagged `clarification_skipped=true` in audit log for later analysis

---

### F1-21 (AI-03) — Decomposition with acceptance criteria

Already covered by F1-19's prompt schema, but verify:
**AC:**

- Every generated task has 2–5 acceptance criteria as a bullet list (rendered as subtasks in the task drawer)
- Every generated task has a description (not just a title)

---

### F1-22 (AI-13) — Effort estimation with confidence

**Backend:**

- `EstimateStoryPointsAsync(task_id)` — sends task details + similar past tasks from same org as context (the method name keeps "StoryPoints" because that's still the unit on `Task`)
- Returns `{ points: 5, confidence: 0.7, reasoning: "..." }`
- Confidence below 0.5 surfaces a warning in UI
- Endpoint: `POST /api/v1/tasks/{id}/estimate`

**Frontend:**

- "Estimate with AI" button on task form
- Show confidence as a colored bar
- Reasoning shown on hover

**AC:**

- Estimation completes in <10s
- Reasoning text references at least one signal (description complexity, similar tasks, team velocity)
- Confidence < 0.5 → yellow banner suggesting human review

---

### F1-23 (AI-14) — Sprint plan draft

**Backend:**

- Endpoint: `POST /api/v1/sprints/{id}/ai-fill` with `{ target_capacity_pct: 80 }`
- AI selects highest-priority backlog tasks that fit the team capacity
- Returns suggestion list with reasoning, doesn't write until user confirms

**Frontend:**

- Sprint planning page → "AI fill to 80%" button
- Suggestions appear as a confirmable list with capacity bar preview

**AC:**

- AI doesn't exceed team capacity (sum of `capacity_hours_per_week` for sprint members, mapped to story points)
- Dependencies respected (won't add a task whose blocker isn't already in the sprint)
- User can edit the suggestion list before confirming

---

# Phase 2 — Private Beta (Weeks 11–20)

**Goal:** Meeting → task reflection loop validated with 3–5 design partner orgs. Real teams using it daily.

---

## 2A — Remaining Project Views

### F2-01 (PM-10) — Roadmap / timeline view

**Backend:** `GET /api/v1/projects/{id}/roadmap` returns epics with start/end dates and dependencies.
**Frontend:**

- `components/roadmap/RoadmapView.jsx` (Gantt-style, custom SVG or `recharts` adapted)
- Drag epic bars to adjust dates
- Diamond markers for milestones, arrows for dependencies

**AC:**

- Drag end-date of epic → cascades to dependents (with confirmation)
- Zoom levels: week / month / quarter
- Only PMs and Team Leads can edit, others see read-only

---

### F2-02 (PM-11) — List view (spreadsheet-style)

**Backend:** Existing task endpoint, with sort/filter query params.
**Frontend:**

- `pages/project/ListPage.jsx`
- Inline edit on click (cell-level)
- Bulk select + bulk action menu (status change, assignee change, delete)
- CSV export client-side

**AC:**

- All task fields visible as columns, columns toggleable
- Inline edit auto-saves
- Bulk status change validates each transition; failed ones reported individually

---

### F2-03 (PM-12) — Calendar view

**Backend:** Same task endpoint, filtered by date range.
**Frontend:**

- `pages/project/CalendarPage.jsx` — month/week toggle
- Sprint bands as background colors
- Drag a task to reschedule its due date
- iCal export endpoint (`GET /api/v1/projects/{id}/calendar.ics`)

**AC:**

- Drag-reschedule persists
- iCal feed renders correctly in Google Calendar / Outlook

---

### F2-04 (PM-13) — Dashboard view

**Backend:** `GET /api/v1/projects/{id}/dashboard` aggregates all metrics.
**Frontend:**

- `pages/project/DashboardPage.jsx` — widget canvas with `react-grid-layout`
- Widgets: BurndownWidget, VelocityWidget, EpicProgressWidget, WorkloadHeatmapWidget, AIHealthWidget
- Layout saved per user per project

**AC:**

- User can add/remove/resize widgets
- Layout persists in `UserDashboardLayout` table
- Widgets refresh on SignalR events

---

### F2-05 (PM-15) — Custom fields

**Backend:**

- `CustomFieldDefinition` (id, project_id, name, field_type, options, required)
- `CustomFieldValue` (id, task_id, definition_id, value_json)
- Field types: text, number, date, single-select, multi-select

**Frontend:**

- `pages/settings/CustomFieldsPage.jsx`
- Custom fields render in TaskForm and TaskDetail

**AC:**

- Required fields validated on save
- Deleting a field is a soft delete with confirmation
- Existing values for deleted definitions kept in DB but hidden

---

### F2-06 (PM-16) — Shareable read-only roadmap link

**Backend:**

- `RoadmapShareLink` (id, project_id, token, password_hash, expires_at, hide_internal_labels, hide_assignees)
- `GET /api/v1/share/roadmap/{token}` — public, no auth, optional password

**Frontend:**

- `pages/share/RoadmapPublicPage.jsx`
- Shareable URL `/share/roadmap/:token`
- "Generate Link" modal in roadmap view with toggles

**AC:**

- Link works without auth
- Expired link shows expiry message
- Password gate works
- Link updates live when project changes

---

### F2-07 (PM-18, PM-19, PM-20, PM-21, PM-22) — Task enhancements

Group these — they're small additions to existing entities:

- **PM-18 attachments:** S3-compatible (MinIO in dev). Entity `Attachment` (id, task_id, file_name, file_size, content_type, storage_key, uploaded_by). 50MB limit.
- **PM-19 labels:** Entity `Label` (id, project_id, name, color). `TaskLabel` join. Multi-select on task form.
- **PM-20 time logging:** Entity `TimeLog` (id, task_id, user_id, minutes, logged_at, comment). Sum displayed on task card.
- **PM-21 WIP limits:** Add `wip_limit` int to `ProjectStatusConfig`. Visual warning when column exceeds limit.
- **PM-22 planning poker:** Real-time via SignalR. Hidden votes until reveal. Average + median shown.

**AC:** each feature works end-to-end, has tests, and is reachable from the relevant view.

---

## 2B — AI Adaptation Loop

### F2-08 (AI-12) — Per-project AI control modes

**Backend:**

- `AIControlMode` enum: Autopilot, Suggest, AskMeFirst, Off
- Field on `Project`. Default `Suggest` for new projects.
- All AI write actions check this before proceeding

**Frontend:**

- `pages/settings/AISettingsPage.jsx` — mode selector with explanations
- Visual indicator on every AI suggestion card showing current mode

**AC:**

- Off mode → no AI suggestions at all, all auto-triggers disabled
- Autopilot → silent application, audit log entry, undo button visible for 24h
- Suggest → cards appear in a dedicated AI inbox
- AskMeFirst → modal blocks until user decides

---

### F2-09 (AI-05) — Task → Done automations

**Backend:**

- MediatR notification handler on `TaskStatusChanged` to `Done`
- Unblocks dependent tasks (sets status from Blocked back to InProgress with AI-suggest card)
- Recomputes epic progress percentage
- Checks if sprint goal achieved → posts celebration in project channel (when channels exist)

**AC:**

- Closing the last task in an epic → epic auto-completes
- Closing a task that was blocking another → blocked task gets a suggest card

---

### F2-10 (AI-06) — Task → Blocked cascade check

**Backend:**

- On block, walk dependency graph to find downstream tasks at risk
- Post a suggest card to PM with the impact

**AC:**

- Cascade analysis completes in <2s even with 100+ task project
- PM sees affected milestones list, not just task list

---

### F2-11 (AI-07) — Sprint close retrospective

**Backend:**

- On sprint close, run `GenerateRetrospectiveAsync` with sprint data (delivered vs planned, blocker log, velocity trend)
- Output: `{ summary, what_went_well, what_didnt, suggestions, next_sprint_draft }`
- Saved as `SprintRetrospective` row, viewable in sprint history

**Frontend:**

- `pages/project/SprintRetroPage.jsx` — generated content + ability to edit
- "Apply next sprint draft" button creates the next sprint with suggested stories

**AC:**

- Retro generated within 30s of close
- All four sections present
- Next sprint draft uses leftover backlog priority

---

### F2-12 (AI-08) — Velocity drop replan

**Backend:**

- Background job runs daily, compares current sprint pace vs 5-sprint average
- If projected milestone delay >10 days, generate 3 replan options:
  1. Cut scope (which stories to descope)
  2. Add resource (which available members)
  3. Shift milestone (by how much, with cascade)
- Post as PM-only suggest card

**AC:**

- Each option includes concrete numbers (story points cut, days saved)
- PM choosing an option triggers the appropriate writes (atomic)

---

### F2-13 (AI-09) — Member leaves / OOO

**Backend:**

- Trigger: user marked OOO, removed from org, or capacity dropped to 0
- Find all their unfinished tasks
- For each, score candidate reassignees by: skill match, current capacity, past similar tasks
- Output ranked list per task

**AC:**

- Suggestions ranked by composite score
- PM can bulk-accept or override per task
- Audit log tracks the reassignment trigger

---

### F2-14 (AI-10) — New feature request → epic + story breakdown

**Backend:**

- Endpoint: `POST /api/v1/projects/{id}/ai/breakdown` with `{ description }`
- Uses similar prompt to project generation but scoped to a single epic
- Shows timeline impact (which milestones shift, which sprints overflow)

**AC:**

- User picks "Add to backlog" or "Add to sprint X"
- Timeline impact shown before commit

---

### F2-15 (AI-11) — PR merged auto-closes task

Covered by F2-23 (GitHub integration). AC validated there.

---

## 2C — Communications & Meetings

### F2-16 (CM-01, CM-02, CM-03, CM-04) — Channels

**Backend:**

- Entity: `Channel` (id, org_id, project_id?, team_id?, name, type, archived_at)
- `ChannelMember` (id, channel_id, user_id, joined_at, last_read_at)
- ChannelType enum: OrgWide, Project, Team, Topic
- Auto-creation: on project create → project channel; on team create → team channel
- Auto-archive topic channels after 30d inactivity (background job)

**Frontend:**

- `components/layout/ChannelSidebar.jsx`
- `pages/chat/ChannelPage.jsx`

**AC:**

- Org channel: only Admins post, all members read-only consume
- Project members auto-joined to project channel
- Topic channels show "linked epic" badge

---

### F2-17 (CM-05) — Direct messages

**Backend:** Channels with type=DM, max 8 members. Cross-project allowed.
**Frontend:** DM list in sidebar, "New DM" modal with user picker.
**AC:** 1:1 and group DMs work, message ordering preserved, unread badge counts correct.

---

### F2-18 (CM-06, CM-07) — Messages, threads, reactions, task cards

**Backend:**

- Entity: `Message` (id, channel_id, parent_message_id?, author_id, body_md, attachments_json, reactions_json, created_at, edited_at)
- SignalR push on new message
- Markdown supported, task card embed via `[[task:123]]` syntax

**Frontend:**

- `components/chat/MessageList.jsx`, `MessageInput.jsx`, `Thread.jsx`
- Task card embed renders as a mini TaskCard

**AC:**

- Threads work (reply opens side panel)
- Reactions are emoji shortcodes (`:+1:` etc), use `emoji-mart`
- Task card preview live-updates if task changes

---

### F2-19 (CM-08) — Schedule meeting

**Backend:**

- Entity: `Meeting` (id, project_id, type, scheduled_at, duration_minutes, recurrence_rule, agenda_md, status)
- `MeetingAttendee` (meeting_id, user_id, response)
- Endpoint: `POST /api/v1/projects/{id}/meetings`
- AI pre-fills agenda from `GenerateMeetingAgendaAsync` based on project context

**Frontend:**

- `pages/meetings/CreateMeetingPage.jsx`
- Recurrence picker (RRULE under the hood)
- AI agenda placeholder, user can edit

**AC:**

- Calendar invite emails sent to attendees (.ics attachment)
- Recurring meetings create a series with one logical link
- Agenda editable up to meeting start time

---

### F2-20 (CM-09) — Built-in video (LiveKit)

**Backend:**

- Integrate LiveKit SDK (or Daily.co — pick one)
- `Meeting.room_token` generated on join
- Server-side token endpoint: `POST /api/v1/meetings/{id}/join` returns LiveKit access token
- Recording enabled, stored to S3-compatible bucket

**Frontend:**

- `pages/meetings/MeetingRoomPage.jsx` using LiveKit React SDK
- Side panel for live transcript and chat

**AC:**

- Video, audio, screen share all work
- Guest join link works without account (token-based)
- Recording starts when first 2 participants join, stops on last leave

---

### F2-21 (CM-10) — Live speaker-labeled transcript

**Backend:**

- Streaming ASR via Deepgram (recommended) or AssemblyAI
- Captures audio from LiveKit, sends to ASR, broadcasts transcript chunks via SignalR
- Stores final transcript in `MeetingTranscript` table (id, meeting_id, segments_json)

**Frontend:**

- Transcript panel in meeting room, auto-scroll
- Segments labeled with speaker name (use LiveKit participant identity)

**AC:**

- Transcript appears within 2s of speech
- Speaker labels accurate (uses LiveKit identity, not voice diarization)
- Final transcript downloadable as .txt or .vtt

---

### F2-22 (CM-11, CM-12) — Post-meeting AI processing + task reflection

**Backend:**

- After meeting ends, `ProcessMeetingTranscriptAsync` runs:
  - Extracts: TL;DR, decisions, action items (with owner + due date), open questions, blockers
- Action items become draft `ActionItem` rows linked to meeting
- Endpoint: `GET /api/v1/meetings/{id}/action-items` returns drafts
- Endpoint: `POST /api/v1/action-items/{id}/accept` creates a task or links to existing task

**Frontend:**

- `pages/meetings/MeetingSummaryPage.jsx`
- `components/meetings/TaskReflection.jsx` — each action item as a card with: match to existing task / create new / dismiss / bulk accept

**AC:**

- Summary generated within 2 min of meeting end
- Action items have suggested owner + due date
- Bulk accept creates all tasks atomically
- Each created task links back to the meeting

---

## 2D — Integrations & Analytics

### F2-23 (INT-01) — GitHub integration

**Backend:**

- OAuth flow: `GET /api/v1/integrations/github/authorize` → GitHub → callback creates `Integration` row
- `Infrastructure/ExternalAdapters/GitHub/GitHubAdapter.cs`
- Webhook receiver: `POST /api/v1/webhooks/github`
- Events handled: branch created, PR opened, PR merged, PR review submitted, CI status
- Branch name pattern parsing: `feat/PROJ-123-description` → links to task PROJ-123

**Frontend:**

- `pages/settings/IntegrationsPage.jsx`
- Per-task: PR badge, CI status pill, "Open PR" button

**AC:**

- New branch matching pattern auto-moves task to InProgress
- PR merged auto-closes linked task
- Failed CI shows red badge with link to logs
- Webhook signature verified with HMAC

---

### F2-24 (INT-08) — Public REST API + OpenAPI

**Backend:**

- All existing endpoints documented with Swashbuckle
- API key auth alternative to JWT for service-to-service
- Rate limiting via `AspNetCoreRateLimit` (per-key, configurable)
- API versioning under `/api/v1/`

**Frontend:**

- Swagger UI at `/swagger`
- `pages/settings/ApiKeysPage.jsx` for org admins to create keys

**AC:**

- All resources accessible via API
- OpenAPI spec downloadable from `/swagger/v1/swagger.json`
- Rate limit headers in responses (`X-RateLimit-*`)

---

### F2-25 (INT-12) — Integration health monitoring

**Backend:**

- Background job pings each integration every 15 min
- `IntegrationHealth` table records status, last_synced, error_message
- Token expiry alert 7 days before expiry

**Frontend:**

- `pages/settings/IntegrationsPage.jsx` — health column on integration list

**AC:**

- Degraded integration shows yellow indicator
- Failed integration pauses sync, shows red, alerts PM

---

### F2-26 (AN-01, AN-02, AN-03) — First charts

**Backend:**

- `GET /api/v1/projects/{id}/analytics/burndown?sprint_id=`
- `GET /api/v1/projects/{id}/analytics/velocity`
- `GET /api/v1/projects/{id}/analytics/epic-progress`

**Frontend:**

- `components/charts/BurndownChart.jsx`, `VelocityChart.jsx`, `EpicProgressBars.jsx` using `recharts`
- Embedded in dashboard widgets and sprint board

**AC:**

- Burndown shows ideal line vs actual
- Velocity shows last 6 sprints with rolling average overlay
- Epic progress recomputed on every story-points change

---

# Phase 3 — Public Beta (Weeks 21–32)

**Goal:** Org-level multi-project usage validated. Ready for general availability.

---

## 3A — Org Maturity

### F3-01 (ORG-08) — Audit log

**Backend:**

- `AuditLog` table (id, org_id, actor_id, action, target_type, target_id, before_json, after_json, ip, user_agent, created_at)
- MediatR pipeline behavior writes audit entries automatically for every command
- Endpoint: `GET /api/v1/orgs/{slug}/audit-log` (Owner + Admin only)

**Frontend:** `pages/settings/AuditLogPage.jsx` with filters by actor, action, date range.
**AC:**

- Every write action logged
- Logs immutable (append-only)
- Searchable + exportable

---

### F3-02 (ORG-09) — SSO / SAML

**Backend:**

- Sustainsys.Saml2 NuGet package
- Per-org IdP configuration
- Endpoint: `GET /sso/{slug}/initiate`, `POST /sso/{slug}/acs`

**Frontend:** SSO config wizard in org settings (Owner only).
**AC:**

- SAML flow works with Okta, Azure AD, Google Workspace
- JIT provisioning creates new users on first SSO login
- SSO required toggle blocks non-SSO logins for the org

---

### F3-03 (ORG-10) — Org branding

**Backend:** Add to Organization: `primary_color`, `logo_url`, `favicon_url`.
**Frontend:** Inject color into CSS variables at runtime via `<style>` tag generated from org config.
**AC:**

- Primary color overrides `--color-primary` for that org
- Logo appears in topbar instead of default

---

### F3-04 (ORG-11) — Member offboarding

**Backend:**

- Endpoint: `POST /api/v1/orgs/{slug}/members/{user_id}/offboard`
- Triggers AI reassignment suggestions for all their open tasks (reuses F2-13)
- Revokes their sessions, removes from org

**AC:**

- Offboarding wizard walks through task reassignment before removal
- Cannot complete until all tasks reassigned or explicitly orphaned

---

## 3B — Comms Polish

### F3-05 (CM-13) — Meeting recording playback

**Backend:** Recording from F2-20 chaptered by AI based on agenda items + topic shifts. `MeetingChapter` table.
**Frontend:** `pages/meetings/MeetingArchivePage.jsx` with chapter timeline below video.
**AC:**

- Click chapter → video seeks to that timestamp
- Full-text search across transcripts in archive
- Access controlled by meeting visibility

---

### F3-06 (CM-14) — Recurring meeting templates

**Backend:** `MeetingTemplate` table with type (standup, sprint-planning, retro, 1:1) and default agenda blocks.
**Frontend:** Template chooser in Create Meeting page.
**AC:** Each template has AI-pre-filled agenda specific to the meeting type.

---

### F3-07 (CM-16) — Notification preferences

**Backend:**

- Entity: `NotificationPreference` (user_id, channel_type, event_type, enabled, dnd_start, dnd_end, digest_mode)
- Notification dispatcher checks prefs before sending

**Frontend:** `pages/settings/NotificationsPage.jsx` matrix view.
**AC:**

- Granular per-event-per-channel toggles
- Do-not-disturb schedule respects user timezone
- Digest mode batches notifications into daily/weekly emails

---

## 3C — Integrations Expansion

### F3-08 (INT-02) — CI/CD build status

**Backend:** Extends GitHub adapter with check_run / status events. CircleCI webhook receiver.
**AC:** Build status badge on task card. Failed builds notify assignee + Team Lead.

---

### F3-09 (INT-03) — GitLab integration

Mirror of F2-23 for GitLab. Same feature parity.

---

### F3-10 (INT-04) — Zendesk escalation

**Backend:**

- Zendesk OAuth + webhook receiver
- "Escalate to dev" → bug task pre-filled (title from ticket subject, repro from body, severity, customer ID)
- Bidirectional: closing the bug optionally closes the ticket

**Frontend:** Zendesk-side widget link in task detail.
**AC:** Full flow from ticket → dev task → resolution → ticket close works.

---

### F3-11 (INT-06) — Slack outbound

**Backend:** `SlackAdapter` posts to configured channel on events: task status changes, sprint started, sprint closed.
**Frontend:** Per-project Slack channel mapping in integration settings.
**AC:** Configurable event filter; messages have rich formatting + back-link to task.

---

### F3-12 (INT-07) — No-code automation builder

**Backend:**

- `AutomationRule` (id, project_id, trigger_type, conditions_json, actions_json, enabled)
- 10+ trigger types: task created, task status changed, comment posted, sprint closed, etc.
- 10+ action types: change status, assign user, post to Slack, create task, send notification

**Frontend:**

- `pages/automation/RuleBuilder.jsx` — visual when/if/then builder
- Test mode: dry-run against historical events

**AC:**

- Rules run within 5s of trigger
- Test mode shows what would have happened, no side effects
- Rule errors logged with retry

---

### F3-13 (INT-09) — Outbound webhooks

**Backend:**

- `WebhookSubscription` (id, project_id, event_types[], url, secret, enabled)
- HMAC-SHA256 signature header
- Retry with exponential backoff (1m, 5m, 30m, 2h, 12h, dead-letter)

**Frontend:** `pages/settings/WebhooksPage.jsx` with delivery log.
**AC:** Failed deliveries retry, then dead-letter; user can replay manually.

---

## 3D — Analytics Depth

### F3-14 (AN-04) — Workload heatmap

**Backend:** `GET /api/v1/projects/{id}/analytics/workload` returns members × story points matrix.
**Frontend:** `components/charts/WorkloadHeatmap.jsx` (custom SVG).
**AC:** Red/amber/green colors per member based on capacity utilization. Hover shows breakdown by sprint.

---

### F3-15 (AN-05) — Auto sprint report

**Backend:** On sprint close (F1-12 + F2-11), generate full report: delivered vs planned, velocity, carryovers, blockers, AI retrospective. Stored as `SprintReport`.
**Frontend:** Reachable from sprint history. Exportable to PDF.
**AC:** Generated within 30s of close. PDF export preserves layout.

---

### F3-16 (AN-06) — Project health score

**Backend:**

- Daily background job per project
- Composite score 0–100 from: velocity vs target, on-time delivery, blocker count, estimation accuracy, scope churn
- Persisted in `ProjectHealthSnapshot` for trend charts

**Frontend:** Score badge on project card. Hover shows component breakdown.
**AC:** Color band: red (<40), amber (40–70), green (>70). Daily snapshot chart in dashboard.

---

### F3-17 (AN-07) — Cycle time + lead time

**Backend:** Computed on task close, stored as task fields, aggregated in analytics endpoint.
**Frontend:** Trend chart per task type and team.
**AC:** Both metrics visible per task and aggregated at team level. Trend over 5 sprints shown.

---

### F3-18 (AN-08) — Weekly AI insight card

**Backend:** Background job generates weekly insight per project using all available data. Plain-English observation + actionable suggestion. Posted to project dashboard + project channel.
**AC:** Generated every Monday morning. References specific data (numbers, names). Suggestion is actionable.

---

### F3-19 (AN-09) — Org portfolio dashboard

**Backend:** `GET /api/v1/orgs/{slug}/portfolio` — health score per project, cross-project resource conflicts (people on multiple projects), org-wide velocity.
**Frontend:** `pages/dashboard/OrgPortfolioPage.jsx`.
**AC:** Drill-down from each project. Resource conflict list ranked by severity.

---

### F3-20 (AN-11) — PDF and CSV exports

**Backend:** Use `QuestPDF` for PDF generation. CSV via `CsvHelper`. Export endpoints per dashboard.
**Frontend:** Export button on every dashboard, with date range and filter state preserved.
**AC:** PDFs preserve layout and charts. CSVs include all rows respecting filters.

---

# Phase 4 — GA v1.0 (Weeks 33–40)

**Goal:** All Must + Should requirements stable. Full regression suite passing. Ready for general availability.

---

### F4-01 — Performance testing

- API response time benchmarks (p50 <100ms, p95 <500ms for read endpoints)
- WebSocket load test: 1000 concurrent connections per project
- Database query analysis, missing index audit
- **AC:** Benchmarks documented, regressions caught in CI.

### F4-02 — Accessibility audit

- WCAG 2.1 AA compliance check on all pages
- Keyboard navigation working everywhere
- Screen reader testing (NVDA + VoiceOver)
- **AC:** Audit report with all findings resolved or explicitly waived.

### F4-03 — Security audit + penetration test

- OWASP Top 10 review
- External pen test (third party)
- Dependency CVE scanning automated
- **AC:** All Critical and High findings fixed before GA.

### F4-04 — End-to-end test suite

- Playwright tests covering all 9 user flows from design doc section 6
- Run on every PR
- **AC:** Suite passes 100% on main branch. Flaky tests <1%.

### F4-05 — Monitoring + alerting

- OpenTelemetry instrumentation
- Sentry for error tracking
- Uptime monitoring (Better Uptime or similar)
- Health checks for all critical paths
- **AC:** On-call dashboard exists. Alerts route to on-call engineer.

### F4-06 — Documentation

- User docs (Docusaurus or similar)
- API reference auto-generated from OpenAPI spec
- Onboarding tutorial for new users
- **AC:** Docs site live, search works, all features documented.

---

# v1.5 Backlog (Post-GA)

Out of scope for v1. Captured here for continuity.

- Enterprise SSO/SAML polish + SOC 2 compliance
- Custom roles (user-definable permission sets)
- White-labelling
- **CM-15** Breakout rooms in meetings
- **INT-05** HubSpot CRM integration
- **INT-10** Zapier / Make connector
- **INT-11** Google Drive document linking
- **AN-10** Custom report builder drag-and-drop
- **AN-12** Predictive milestone forecasting
- **AN-13** Meeting ROI metric
- Multi-sprint epic phase bars on roadmap

---

# Where to Start

**Strict ordering:**

1. **F0-01 → F0-07** — get the skeleton green. Don't write a single feature until all of Phase 0 is done.
2. **F1-01 → F1-05** — org foundation, so users have somewhere to put projects.
3. **F1-06 → F1-09** — project + task entities + state machine. This is the data backbone.
4. **F1-10 → F1-13** — Kanban + sprint views. First user-visible value.
5. **F1-14** — SignalR. Add it once before the AI stuff so AI updates push live.
6. **F1-15 → F1-17** — fill in remaining alpha features.
7. **F1-18 → F1-23** — the AI generation loop. **This is the differentiator. Give it the most attention.**
8. Stop. Use the alpha internally for at least 1 sprint before moving on.
9. Then Phase 2.

**Do not start meetings, integrations, or analytics until Phase 1 is shippable.**

---

# Visual polish baseline (2026-05)

The Phase 1 screens that exist today (App Shell, Kanban Board, Task Detail drawer, AI Generation Wizard) have been brought in line with the `/Design Files/` Stratos mockups. Any new screen must follow these conventions out of the box — don't ship a new page that "looks Phase 1" and queue polish as a follow-up.

**Always do:**

- Use the Stratos shell classes from `frontend/src/styles/stratos.css` — never recreate `.app-sidebar`, `.app-topbar`, `.icon-btn`, `.side-item`, `.crumb`, `.menu`, `.tabs`, etc. with new BEM names.
- Use the Stratos primitives from `frontend/src/components/ui/` — `Button`, `Badge`, `StatusBadge`, `Priority`, `Avatar`, `AvatarStack`, `AIChip`, `Sparkline`, `Card`, etc. If a primitive is missing, build it under `components/ui/<Name>/` (flat class names, theme-aware tokens, exported from `index.js`).
- Mirror the design's structure: page headers use `.page-header`, sub-headings use `.subsection-eyebrow`, AI surfaces use `.card-ai`, KPI tiles stack `kpi-label` over a large numeric value.
- Reference `/Design Files/screen-*.jsx` for any new screen you're building. Even when the data wiring differs, the visual shape (header, columns, tile, drawer split) should match.

**Never do:**

- Hardcode colors, font sizes, spacing, radii, shadows, or durations. Use the tokens in `frontend/src/styles/tokens.css`.
- Use BEM (`btn--primary`); Stratos is flat (`btn-primary`) and uses `.is-*` state classes.
- Add a page-level CSS class that overlaps a stratos.css class (e.g. don't redefine `.app-topbar` in a page CSS file).
