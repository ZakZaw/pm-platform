# Platform Design Document — Changelog

> The canonical narrative design lives in `platform_design_document_full.docx` (v1.0).
> This file lists everything that **supersedes or amends** that document since v1.0.
> When the .docx and this file disagree, **this file wins.**
>
> When you ship a change that breaks an assumption in the .docx, append a dated entry here. Don't edit the .docx in place — its v1.0 narrative is the historical baseline and we keep diffs in markdown for traceability.

---

## 2026-05-18 (later) — Workflow loosened, board enhancements, /home placeholder

### Domain — task status transitions are now unrestricted

The original design doc described a strict task state machine
(Backlog → ToDo → InProgress → InReview → Done with a few side branches).
That has been **lifted**. `TaskStatusTransition.EnsureValid` now only
rejects no-op transitions and still requires a reason for moves to
**Blocked** or **WontDo** — those reasons are kept because they're
useful audit signals, not transition rules. Any other from→to pair is
allowed.

### UI — Task priority is editable

The Priority meta row in the task drawer was read-only. Replaced with a
new `PriorityDropdown` primitive that mirrors `StatusDropdown` — same
Stratos shape, four levels (Urgent / High / Medium / Low). PATCHes via
`tasksApi.update({ priority })`.

### API — Project board includes Backlog

`GetBoardQuery` previously filtered out Backlog tasks when no sprint
was selected, so the Backlog column never appeared on the project board.
The filter is removed; the fallback column order also includes Backlog
as the first column. Existing projects' `ProjectStatusConfig` rows
already have Backlog (seeded by `StatusConfigDefaults`), so no migration
is needed.

### UI — Per-user column visibility (with persistence)

New `useColumnVisibility(scope, defaults)` hook + `ColumnsButton`
component. Scoped per user via `localStorage` keys like
`pm:cols:{userId}:board:{projectId}` and `pm:cols:{userId}:sprint:{sprintId}`,
so the project board and the sprint board each carry their own
column-visibility selection. New project tasks show every workflow
status by default; once the user hides anything, the choice is sticky
across sessions (per-user, per-browser).

The button appears next to "Filter" on both BoardPage and
SprintBoardPage, with a count badge for hidden columns.

### UI — Drag-and-drop card stays above all columns

While dragging a kanban card, the source element used to translate
under the column tree and got clipped by each column's
`overflow-y: auto`. Switched to dnd-kit's `DragOverlay`, which paints
the dragged card as a floating clone above everything (z-index 2000).
The source card is hidden during drag so we don't render two of the
same card. Applied to both the project board (`KanbanBoard.jsx`) and
MyWorkPage.

### UI — `/home` placeholder dashboard

New `HomePage` at `/home` — landing page for the user's performance
across every project. KPI tiles (tasks completed, cycle time, streak,
velocity), a weekly throughput sparkline, an AI weekly insight card,
and a per-project drill-down list. All numbers are sample data with
clear "· sample" suffixes until F2-04 / F3-16 / F3-18 ship the
analytics endpoints.

`/` now redirects to `/home` (was `/dashboard`). MyWorkPage stays at
`/dashboard` unchanged. The sidebar gains a "Home" item above "My work".

---

## 2026-05-18 — Human-friendly task IDs + orphan-page polish + MyWork kanban

### Schema — `Project.Key` + `Task.KeyNum`

The .docx originally described tasks by UUID. Tasks now have a **human-friendly display ID** like `AT-247`, composed server-side from two new columns:

- `Project.Key` — 2–4 character prefix derived from the project name (e.g. "Atlas" → "AT"). Unique within an organization; suffixed on collision ("AT2"). Set on project create and never changes.
- `Task.KeyNum` — per-project monotonic serial. Assigned on create, never reused, even after a task is deleted.

Composed key flows through every task-shaped DTO (`TaskDto.Key`, `BoardCardDto.Key`, `BacklogTaskDto.Key`, `MyWorkItemDto.Key`). Frontend cards and the drawer display this everywhere they previously used a UUID prefix.

Migration `20260518000000_AddProjectKeyAndTaskKeyNum` adds columns nullable, back-fills via SQL (Project.Key = first 2 letters of Name + collision suffix per org; Task.KeyNum = row_number per project ordered by CreatedAt), then enforces NOT NULL + unique indexes. Personal projects all get `Key = "PE"` (one per user, no collision risk).

To apply locally:

```
dotnet ef database update --project src/Infrastructure --startup-project src/Api
```

### UI — Dropdown menus stay inside the viewport

`Dropdown.jsx` was placing the `.menu` with absolute `top:100%` + a fixed `align`. Menus near the right edge of the page (or inside the 560px task drawer) would spill offscreen. The component now reads the trigger's bounding rect after opening and **flips alignment to `end`** when right-overflow would occur, and **flips to the top side** when bottom-overflow would occur. CSS `max-width: min(360px, 100vw - 16px)` + `max-height: min(360px, 100vh - 80px)` with internal scroll guarantee the menu stays inside any container.

### UI — `.page` utility for orphan pages

Pages without a `/Design Files/screen-*.jsx` counterpart (project home, epics, backlog, sprints, sprint board, workflow settings, project members, org home, org members, profile, create-project, create-org) previously had inconsistent padding — some bled to the edge of the scroll container. Added `.page` (and `.page-narrow` / `.page-wide`) utility classes to `stratos.css` and applied them to every orphan page root, giving them the same outer padding rhythm as the Stratos-designed pages.

### UI — Task detail drawer surfaces the task ID

The drawer previously showed the task ID only as a small muted chip in the top action bar. There's now also a **clickable mono-text ID chip** above the title (e.g. `AT-247`) with a copy icon — click it to copy the key to clipboard.

### UI — MyWork page uses the kanban layout

`/dashboard` (MyWork) was a vertical list of cards in tone-coloured boxes. Rewritten to use the same kanban shape as the project Board: 5 columns (Backlog / ToDo / InProgress / InReview / Blocked), Stratos `.kanban-card` styling, drag-to-move, status counts + story-points per column header. Cross-project data wiring (project filter, sprint filter, drag-to-changeStatus) unchanged.

---

## 2026-05-17 — Project Dashboard page added

A new project-scoped Dashboard at `/:slug/projects/:projectSlug/dashboard` matching `/Design Files/screen-dashboard.jsx`. Added to the project sub-nav between Board and Backlog.

**Live data:**
- KPI tile **Open tasks** (count of cards in any non-Done / non-WontDo column for the project)
- **Sprint burndown** total/done/days-left (when an active sprint exists; falls back to a sample shape otherwise)
- **Epic progress** bars (real epics, real task counts from the board)

**Sample data, flagged in the UI with a `· sample` suffix and a banner at the top of the page** — backend doesn't yet expose:
- Velocity (last 7 sprints, committed vs completed)
- Project health gauge + 6 component signals
- Team workload heatmap (people × days)
- AI Weekly Insight card
- Recent activity feed
- KPIs: On track, Bug ratio, Avg cycle time

These widgets will swap to live data when the analytics endpoints from F2-04 / F2-26 / F3-16 ship. The visual shells stay the same.

**New chart components** (in `frontend/src/components/charts/`, all token-styled SVG, accept tabular props):

- `BurndownChart({ total, actual[], today, days })`
- `VelocityChart({ sprints[{ name, committed, completed, current }] })`
- `HealthGauge({ score, size, stroke })`
- `WorkloadHeatmap({ days, data[{ name, load[] }] })`

**New `Icon` primitive** at `components/ui/Icon/Icon.jsx` — kebab-case wrapper over `lucide-react` (e.g. `<Icon name="bar-chart-3" />`) matching the design-file API. Uses an explicit per-icon registry (not a `import * as` namespace) so the bundle tree-shakes — initially loaded with ~60 commonly used icons; add new ones as you reach for them. Direct `lucide-react` named imports still work — Icon is for places where the design-file mockup uses the kebab API.

---

## 2026-05-17 — Phase 1 polish & Stratos shell adoption

### UI — App Shell rebuilt on the Stratos grid

The application shell described in the .docx ("topbar above main content, sidebar to the left") was previously implemented as a flexbox `app-shell` wrapper with BEM class names. It has been rebuilt to match `/Design Files/screen-shell.jsx`:

- **`.app` grid** (rows: 44px topbar / 1fr main; columns: 220px sidebar / 1fr content; sidebar `grid-row: 1 / 3` spans both rows). Collapsing the sidebar swaps the column to 56px via `.app.is-collapsed`.
- **Sidebar** uses the Stratos vocabulary: `.org` brand + `.org-mark` letter chip + `.org-name` / `.org-plan` lines, `.side-section` uppercase headings, `.side-item.is-active` nav items, `.side-footer` with the current user. Project list shows a stable color swatch (`.av-1..8`) per project; expanding a project reveals an indented sub-nav (Epics / Board / Backlog / Sprints / Members / Workflow).
- **Topbar** has: sidebar-toggle `.icon-btn`, URL-derived breadcrumb (`.crumb` / `.crumb-link` / `.sep` / `.here`), search-mini (`Cmd+K` kbd), `.divider-y`, "New task" primary button, AI sparkles `.icon-btn`, notifications bell with `.indicator`, theme toggle, help icon, user-menu trigger that opens a `.menu`.

The previous BEM classes (`.app-shell`, `.sidebar__link`, `.topbar__breadcrumb`, etc.) are gone. New screens **must** reuse `.app-sidebar` / `.app-topbar` / `.side-item` / `.icon-btn` etc. from `frontend/src/styles/stratos.css`.

### UI — Kanban Board sprint banner

The .docx (section 7) describes the sprint board as "Kanban with sprint header showing goal and days remaining". The header has been promoted to a full **sprint banner** matching `/Design Files/screen-kanban.jsx`:

- Left block: `Sprint N` badge + date range + live indicator + Goal text
- KPI tiles: BURNDOWN (`Sparkline`), POINTS (done / total), DAYS LEFT (warning color when ≤3)
- Right cluster: Filter button (popover toggle), Add task (primary)

When the project has no active sprint, the page falls back to the standard `.page-header`. The card itself was redesigned: short key + Priority bars on top, multi-line title, optional blocker chip (`status-danger` background) when blocked, footer with assignee on the left and comments / attachments / story-points pill on the right.

### UI — Task Detail drawer rebuilt

The .docx (section 7.3) describes a "right-side drawer with title, status, assignee, description, subtasks, comments". The drawer has been rebuilt to match `/Design Files/screen-task.jsx`:

- Width: 560px (was 520px)
- Layout: two-column grid (main 1fr + meta 220px)
- Header row: short key · sprint badge · epic badge · Copy / Open / More / Close icon-btns
- Main column: large title, reporter byline with watcher count, Description, **Acceptance criteria** as a checkbox list (rendered from `Subtask` rows — the entity didn't change, only the UI label), tabbed Activity (Comments active; History and Commits show "coming in Phase 2" placeholders)
- Meta column: Status / Assignee / Reviewer / Priority (with `Priority` bars) / Points / Due / Sprint / Epic / Labels / Delete
- Composer footer uses existing `CommentInput`

### UI — AI Generation Wizard rebuilt

Matches `/Design Files/screen-ai-wizard.jsx`:

- Centered radial-gradient canvas
- AIChip header + display title + subtitle
- Pill stepper (Describe → Clarify → Review & confirm) with done/active/pending dots and connector lines
- Prompt-recap card with quote icon + Edit button + clarifying-question badges (purple tone)
- `card-ai` generated-plan box with sparkles header, count strip, TreeNode rows (Badge + key + title + points + edit/regenerate icon-btns), footer action bar (Regenerate / Add epic / Save as draft / Confirm & create)
- Ghosted previous-steps `grid-2` recap below

### New UI primitives

Added to `frontend/src/components/ui/`:

- **`Priority`** — `level` prop (urgent/high/med/low or Urgent/High/Medium/Low). Renders three increasing bars per the `.prio` pattern.
- **`AvatarStack`** — `people` + `max` + `size`. Overlapped avatars with `+N` overflow chip.
- **`Sparkline`** — `points` + `width` + `height` + `ideal` + `stroke`. Compact SVG line chart used in the sprint banner; designed to be reused by Phase 2 dashboard widgets.

### Stratos shell stylesheet

New file: `frontend/src/styles/stratos.css` (imported from `global.css`). Holds every shell + utility class that the design system reuses across screens (`.app`, `.app-sidebar`, `.app-topbar`, `.icon-btn`, `.menu`, `.tabs`, `.subsection`, `.kbd`, `.hstack/vstack/grow`, `.grid-2/3/4`, `.prio`, `.avatar-stack`, `.card-ai`, etc.). No page CSS should redefine any of these classes.

---

## 2026-05 (earlier) — Phase 1 rework

### Schema — `Story` entity removed

The .docx (section 4 "Data Model", Cluster 2) lists `Epic → Story → Task → Subtask`. The Story layer has been **dropped entirely**:

- `Task` now sits directly under `Epic` (Task has `epic_id`, no `story_id`).
- The `SprintStory` join table is replaced by `SprintTask`.
- `Subtask` rows attached to a Task are now rendered in the UI as **acceptance criteria** (checkbox list). The `Subtask` entity itself is unchanged.
- The field `story_points` (Fibonacci unit) **remains on `Task`** — it's a measure, not an entity link. The IAIService method `EstimateStoryPointsAsync(task_id)` keeps its name for the same reason.

Reasons:

1. Story added a layer of indirection nobody used — every PM in dogfooding created exactly one story per epic-feature, then attached tasks directly.
2. The AI generation prompt was producing inconsistent epic→story→task splits; flattening it to epic→task with subtasks-as-AC dramatically improved quality.
3. The Kanban / backlog / sprint UIs only ever needed Task-grain anyway.

### Schema cluster correction

CLAUDE.md "Schema clusters" was updated to:
> Cluster 2: Project Work (Epic, **Task**, Subtask, Sprint, **SprintTask**, Comment, Attachment)

(Was: Epic, Story, Task, Subtask, Sprint, SprintTask, Comment, Attachment.)

### AI prompt schema simplified

The project-generation prompt's JSON schema was:

```json
{ "epics": [{ "title", "stories": [{ "tasks": [...] }] }] }
```

It is now:

```json
{ "epics": [{ "title", "tasks": [{ "title", "description", "story_points", "priority", "acceptance_criteria": [...] }] }] }
```

Acceptance criteria are written into `Subtask` rows on each generated task.

### Endpoint renames

- `POST /api/v1/stories/{id}/estimate` → `POST /api/v1/tasks/{id}/estimate`
- `/api/v1/projects/{id}/stories` (full CRUD) — **removed entirely** (no replacement; use `/tasks`)

### Backend-internal renames

- `SprintStory` → `SprintTask` (join table, entity, navigation properties)
- `SprintStoryConfiguration` → `SprintTaskConfiguration` (EF Core)

---

## How to update this changelog

Append a new dated section at the **top** of the document (newest first). Each entry should call out:

1. **What was in the .docx** that is now wrong (quote the section if useful).
2. **What it is now** (the current truth).
3. **Why** (one or two sentences — context for the next reviewer).

When a section grows old enough that it predates everything the team remembers, that's a signal to spin a v1.1 of the design document. Until then, this file is the live correction layer.
