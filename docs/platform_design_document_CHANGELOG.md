# Platform Design Document — Changelog

> The canonical narrative design lives in `platform_design_document_full.docx` (v1.0).
> This file lists everything that **supersedes or amends** that document since v1.0.
> When the .docx and this file disagree, **this file wins.**
>
> When you ship a change that breaks an assumption in the .docx, append a dated entry here. Don't edit the .docx in place — its v1.0 narrative is the historical baseline and we keep diffs in markdown for traceability.

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
