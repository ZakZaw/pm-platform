import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  Flag,
  ListChecks,
  Play,
  Plus,
  Rocket,
  Sparkles,
  Square,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AISuggestionCard, Avatar, Badge, Button, Card, useToast } from '@/components/ui';
import { BurndownChart } from '@/components/charts';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { projectsApi } from '@/api/projects.api';
import { sprintsApi } from '@/api/sprints.api';
import { boardApi } from '@/api/board.api';
import { tasksApi } from '@/api/tasks.api';
import { aiApi } from '@/api/ai.api';
import { describeAiError } from '@/components/ai/aiErrors';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useConfirm } from '@/hooks/useConfirm';
import './SprintDetailPage.css';

const STATUS_TONE = { Planning: 'neutral', Active: 'info', Closed: 'success' };

function daysBetween(a, b) {
  if (!a || !b) return 0;
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

function buildBurndown(total, done, days, today) {
  if (!total || !days) return { actual: [], today: 0 };
  const remaining = total - done;
  const actual = Array.from({ length: days + 1 }, (_, i) => {
    if (i > today) return null;
    if (today === 0) return total;
    const ratio = i / today;
    return total - (total - remaining) * ratio;
  });
  return { actual, today };
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function SprintDetailPage() {
  const { slug: orgSlug, projectSlug, sprintId } = useParams();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { members } = useOrgMembers(orgSlug);

  const [project, setProject] = useState(null);
  const [sprint, setSprint] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [openedTaskId, setOpenedTaskId] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [aiFillPlan, setAiFillPlan] = useState(null);
  const [aiFillLoading, setAiFillLoading] = useState(false);
  const [aiFillTarget, setAiFillTarget] = useState(80);

  // Editable name buffer.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  useEffect(() => {
    if (sprint) setNameDraft(sprint.name);
  }, [sprint?.id, sprint?.name]);

  const memberById = useMemo(() => {
    const map = {};
    for (const m of members) map[m.userId] = m;
    return map;
  }, [members]);

  const taskGroups = useMemo(() => {
    if (!board) return [];
    const groups = new Map();
    for (const lane of board.swimlanes) {
      for (const col of lane.columns) {
        if (!groups.has(col.status)) {
          groups.set(col.status, { status: col.status, displayName: col.displayName ?? col.status, cards: [] });
        }
        const g = groups.get(col.status);
        for (const card of col.cards) g.cards.push(card);
      }
    }
    return [...groups.values()].filter((g) => g.cards.length > 0);
  }, [board]);

  const assigneeBreakdown = useMemo(() => {
    const counts = {};
    if (!board) return [];
    for (const lane of board.swimlanes) {
      for (const col of lane.columns) {
        for (const card of col.cards) {
          const key = card.assigneeId ?? '__none__';
          if (!counts[key]) counts[key] = { id: card.assigneeId ?? null, tasks: 0, points: 0 };
          counts[key].tasks += 1;
          counts[key].points += card.storyPoints ?? 0;
        }
      }
    }
    return Object.values(counts).sort((a, b) => b.points - a.points);
  }, [board]);

  const load = useCallback(async (projectId) => {
    const [sprints, b] = await Promise.all([
      sprintsApi.listForProject(projectId),
      boardApi.get(projectId, { sprintId }).catch(() => null),
    ]);
    const s = sprints.find((x) => x.id === sprintId);
    setSprint(s ?? null);
    setBoard(b);
  }, [sprintId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await load(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load sprint.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug, load]);

  async function patchSprint(body, errMsg = 'Could not save change.') {
    try {
      const updated = await sprintsApi.update(sprintId, body);
      setSprint(updated);
      return updated;
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? errMsg,
      });
      return null;
    }
  }

  function commitName() {
    const t = nameDraft.trim();
    if (t === sprint.name) {
      setEditingName(false);
      return;
    }
    if (t.length < 2 || t.length > 120) {
      toast.show({ tone: 'danger', message: 'Name must be 2–120 characters.' });
      setNameDraft(sprint.name);
      setEditingName(false);
      return;
    }
    patchSprint({ name: t }, 'Could not rename sprint.');
    setEditingName(false);
  }

  function commitStartDate(value) {
    if (!value) return;
    const iso = new Date(`${value}T00:00:00Z`).toISOString();
    patchSprint({ startDate: iso }, 'Could not change start date.');
  }
  function commitEndDate(value) {
    if (!value) return;
    const iso = new Date(`${value}T00:00:00Z`).toISOString();
    patchSprint({ endDate: iso }, 'Could not change end date.');
  }
  function commitVelocityTarget(value) {
    const raw = value.trim();
    if (raw === '') {
      patchSprint({ clearVelocityTarget: true }, 'Could not clear velocity target.');
      return;
    }
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n > 1000) {
      toast.show({ tone: 'danger', message: 'Velocity target must be 0–1000.' });
      return;
    }
    patchSprint({ velocityTarget: n }, 'Could not set velocity target.');
  }

  async function startSprint() {
    try {
      await sprintsApi.start(sprintId);
      toast.show({ tone: 'success', message: `${sprint.name} started.` });
      await load(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not start sprint',
        message: err.response?.data?.detail ?? '',
      });
    }
  }

  async function closeSprint() {
    const ok = await confirm({
      title: `Close ${sprint.name}?`,
      message: 'Incomplete tasks will move back to the backlog. Final velocity gets recorded.',
      confirmLabel: 'Close sprint',
      tone: 'warning',
    });
    if (!ok) return;
    try {
      await sprintsApi.close(sprintId, { moveCarryoversToBacklog: true });
      toast.show({ tone: 'success', message: `${sprint.name} closed.` });
      await load(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not close sprint',
        message: err.response?.data?.detail ?? '',
      });
    }
  }

  async function requestAiFill() {
    setAiFillLoading(true);
    try {
      const plan = await aiApi.aiFillSprint(sprintId, aiFillTarget);
      setAiFillPlan(plan);
      if ((plan.picks ?? []).length === 0) {
        toast.show({
          tone: 'info',
          message: 'AI found nothing in the backlog that fits the capacity.',
        });
      }
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: describeAiError(err, 'Could not get an AI fill suggestion.'),
      });
    } finally {
      setAiFillLoading(false);
    }
  }

  async function applyAiFill() {
    if (!aiFillPlan?.picks?.length) return;
    setAiFillLoading(true);
    let added = 0;
    try {
      for (const pick of aiFillPlan.picks) {
        // eslint-disable-next-line no-await-in-loop
        await tasksApi.update(pick.taskId, { sprintId });
        added += 1;
      }
      toast.show({ tone: 'success', message: `Added ${added} tasks to the sprint.` });
      setAiFillPlan(null);
      await load(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message:
          err.response?.data?.detail
          ?? `Added ${added} tasks before an error stopped the rest.`,
      });
    } finally {
      setAiFillLoading(false);
    }
  }

  async function addTaskToSprint(e) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (title.length < 2) return;
    setCreating(true);
    try {
      await tasksApi.create(project.id, {
        title,
        priority: 'Medium',
        sprintId,
      });
      setNewTaskTitle('');
      await load(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create task.',
      });
    } finally {
      setCreating(false);
    }
  }

  if (error) return <p className="sprint-detail__placeholder">{error}</p>;
  if (!project || !sprint) return <p className="sprint-detail__placeholder">Loading…</p>;

  const sprintLen = daysBetween(sprint.startDate, sprint.endDate);
  const today =
    sprint.status === 'Closed'
      ? sprintLen
      : Math.min(sprintLen, daysBetween(sprint.startDate, new Date().toISOString()));
  const daysLeft = Math.max(0, sprintLen - today);
  const pct = sprint.totalPoints > 0
    ? Math.round((sprint.donePoints / sprint.totalPoints) * 100)
    : 0;
  const { actual: burnPoints } = buildBurndown(
    sprint.totalPoints || 0,
    sprint.donePoints || 0,
    sprintLen,
    today,
  );
  const canEditDates = sprint.status !== 'Closed';

  return (
    <div className="page sprint-detail">
      {dialog}

      <Link
        to={`/${orgSlug}/projects/${projectSlug}/sprints`}
        className="sprint-detail__back"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Sprints
      </Link>

      <header className="sprint-detail__header">
        <div className="sprint-detail__head-text">
          <div className="sprint-detail__head-row">
            <Rocket size={18} aria-hidden="true" className="sprint-detail__head-icon" />
            {editingName ? (
              <input
                className="sprint-detail__title-input"
                value={nameDraft}
                autoFocus
                maxLength={120}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitName();
                  } else if (e.key === 'Escape') {
                    setNameDraft(sprint.name);
                    setEditingName(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="sprint-detail__title sprint-detail__title--edit"
                onClick={() => setEditingName(true)}
                title="Click to rename"
              >
                {sprint.name}
              </button>
            )}
            <Badge tone={STATUS_TONE[sprint.status] ?? 'neutral'}>{sprint.status}</Badge>
            {sprint.status === 'Active' && (
              <Badge tone={daysLeft <= 2 ? 'warning' : 'info'}>
                {daysLeft} day{daysLeft === 1 ? '' : 's'} left
              </Badge>
            )}
          </div>
        </div>
        <div className="sprint-detail__actions">
          {sprint.status === 'Planning' && (
            <Button onClick={startSprint}>
              <Play size={13} aria-hidden="true" /> Start sprint
            </Button>
          )}
          {sprint.status === 'Active' && (
            <>
              <Link to={`/${orgSlug}/projects/${projectSlug}/sprints/${sprint.id}/board`}>
                <Button variant="secondary">Open board</Button>
              </Link>
              <Button variant="ghost" onClick={closeSprint}>
                <Square size={13} aria-hidden="true" /> Close
              </Button>
            </>
          )}
          {sprint.status === 'Closed' && (
            <Link to={`/${orgSlug}/projects/${projectSlug}/sprints/${sprint.id}/board`}>
              <Button variant="secondary">View board</Button>
            </Link>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className="sprint-detail__kpis">
        <Card className="sprint-detail__kpi">
          <div className="sprint-detail__kpi-label">
            <ListChecks size={12} aria-hidden="true" /> Tasks
          </div>
          <div className="sprint-detail__kpi-value">{sprint.taskCount}</div>
        </Card>
        <Card className="sprint-detail__kpi">
          <div className="sprint-detail__kpi-label">
            <Target size={12} aria-hidden="true" /> Points
          </div>
          <div className="sprint-detail__kpi-value">
            {sprint.donePoints}<span className="muted"> / {sprint.totalPoints}</span>
          </div>
          <div className="sprint-detail__kpi-sub">{pct}% complete</div>
        </Card>
        <Card className="sprint-detail__kpi">
          <div className="sprint-detail__kpi-label">
            <TrendingUp size={12} aria-hidden="true" /> Velocity target
          </div>
          <input
            type="number"
            min={0}
            max={1000}
            defaultValue={sprint.velocityTarget ?? ''}
            key={sprint.velocityTarget ?? 'empty'}
            placeholder="—"
            className="sprint-detail__kpi-input"
            onBlur={(e) => commitVelocityTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            aria-label="Velocity target"
          />
        </Card>
        <Card className="sprint-detail__kpi">
          <div className="sprint-detail__kpi-label">
            <Flag size={12} aria-hidden="true" /> Final velocity
          </div>
          <div className="sprint-detail__kpi-value">
            {sprint.finalVelocity ?? <span className="muted">—</span>}
          </div>
          <div className="sprint-detail__kpi-sub">
            {sprint.status === 'Closed' ? 'Recorded on close' : 'Locks at close'}
          </div>
        </Card>
      </div>

      <div className="sprint-detail__grid">
        <section className="sprint-detail__col-wide">
          <Card className="sprint-detail__card">
            <div className="hstack sprint-detail__card-head">
              <div>
                <div className="sprint-detail__card-title">Progress</div>
                <div className="muted sprint-detail__card-sub">
                  {sprint.status === 'Active'
                    ? `Day ${today} of ${sprintLen} · ${daysLeft} left`
                    : sprint.status === 'Closed'
                      ? 'Sprint closed'
                      : 'Not started yet'}
                </div>
              </div>
            </div>
            <div className="sprint-detail__chart-wrap">
              <BurndownChart
                total={sprint.totalPoints || 1}
                actual={burnPoints}
                today={today}
                days={sprintLen || 14}
                width={620}
                height={180}
              />
            </div>
          </Card>

          {sprint.status === 'Planning' && (
            <Card className="sprint-detail__card">
              <div className="hstack sprint-detail__card-head">
                <div>
                  <div className="sprint-detail__card-title">
                    <Sparkles size={12} color="var(--ai-violet)" aria-hidden="true" /> AI fill
                  </div>
                  <div className="muted sprint-detail__card-sub">
                    Let AI propose which backlog tasks fit a target capacity.
                  </div>
                </div>
                <span className="grow" />
                <input
                  type="number"
                  min={20}
                  max={100}
                  step={5}
                  value={aiFillTarget}
                  onChange={(e) => setAiFillTarget(parseInt(e.target.value, 10) || 80)}
                  className="sprint-detail__kpi-input"
                  aria-label="Target capacity percent"
                  style={{ width: 60 }}
                />
                <span className="muted" style={{ fontSize: 12 }}>% capacity</span>
                <Button
                  variant="ai"
                  size="sm"
                  onClick={requestAiFill}
                  disabled={aiFillLoading}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  {aiFillLoading ? ' Thinking…' : ' Suggest fill'}
                </Button>
              </div>

              {aiFillPlan && (
                <div style={{ marginTop: 'var(--s-5)' }}>
                  <AISuggestionCard
                    chipLabel="AI fill"
                    title={`Add ${aiFillPlan.picks.length} tasks (${aiFillPlan.selectedPoints} / ${aiFillPlan.targetCapacityPoints} pts)`}
                    body={aiFillPlan.reasoning}
                    onApply={applyAiFill}
                    applyLabel="Add to sprint"
                    applyDisabled={aiFillPlan.picks.length === 0}
                    loading={aiFillLoading}
                    onDismiss={() => setAiFillPlan(null)}
                    footer={`${aiFillPlan.picks.length} pick${aiFillPlan.picks.length === 1 ? '' : 's'} fit within the target.`}
                  />
                </div>
              )}
            </Card>
          )}

          <Card className="sprint-detail__card">
            <div className="sprint-detail__card-title">Tasks ({sprint.taskCount})</div>

            {sprint.status !== 'Closed' && (
              <form className="sprint-detail__create" onSubmit={addTaskToSprint}>
                <input
                  type="text"
                  className="sprint-detail__create-input"
                  placeholder="Add a task to this sprint…"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  maxLength={200}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating || newTaskTitle.trim().length < 2}
                >
                  <Plus size={14} aria-hidden="true" /> Add
                </Button>
              </form>
            )}

            {taskGroups.length === 0 ? (
              <p className="sprint-detail__placeholder">No tasks in this sprint yet.</p>
            ) : (
              <div className="sprint-detail__task-groups">
                {taskGroups.map((g) => (
                  <div key={g.status} className="sprint-detail__task-group">
                    <div className="sprint-detail__group-head">
                      <span>{g.displayName}</span>
                      <span className="mono dim">{g.cards.length}</span>
                    </div>
                    <ul className="sprint-detail__task-list">
                      {g.cards.map((card) => {
                        const a = card.assigneeId ? memberById[card.assigneeId] : null;
                        return (
                          <li
                            key={card.taskId}
                            className="sprint-detail__task-row is-interactive"
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenedTaskId(card.taskId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpenedTaskId(card.taskId);
                              }
                            }}
                          >
                            <span className="mono dim sprint-detail__task-key">
                              {card.key ?? card.taskId.slice(0, 4).toUpperCase()}
                            </span>
                            <span className="sprint-detail__task-title">{card.title}</span>
                            <Badge tone="info">{card.priority}</Badge>
                            {card.storyPoints != null && (
                              <Badge tone="purple">{card.storyPoints} pts</Badge>
                            )}
                            {a ? (
                              <Avatar src={a.avatarUrl} name={a.fullName} size="xs" />
                            ) : (
                              <span className="sprint-detail__unassigned" title="Unassigned" />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section className="sprint-detail__col-narrow">
          <Card className="sprint-detail__card">
            <div className="sprint-detail__card-title">
              <Calendar size={12} aria-hidden="true" /> Dates
            </div>
            <ul className="sprint-detail__facts">
              <li>
                <span>Start (planned)</span>
                <span className="sprint-detail__date-cell">
                  {canEditDates ? (
                    <input
                      type="date"
                      className="sprint-detail__date-input"
                      defaultValue={toDateInput(sprint.startDate)}
                      key={`start-${sprint.startDate}`}
                      onChange={(e) => commitStartDate(e.target.value)}
                      aria-label="Planned start date"
                    />
                  ) : (
                    fmtDate(sprint.startDate)
                  )}
                </span>
              </li>
              <li>
                <span>End</span>
                <span className="sprint-detail__date-cell">
                  {canEditDates ? (
                    <input
                      type="date"
                      className="sprint-detail__date-input"
                      defaultValue={toDateInput(sprint.endDate)}
                      key={`end-${sprint.endDate}`}
                      onChange={(e) => commitEndDate(e.target.value)}
                      aria-label="End date"
                    />
                  ) : (
                    fmtDate(sprint.endDate)
                  )}
                </span>
              </li>
              <li>
                <span>Actual start</span>
                <span>{fmtDate(sprint.actualStartDate)}</span>
              </li>
              <li><span>Length</span><span>{sprintLen} day{sprintLen === 1 ? '' : 's'}</span></li>
              <li><span>Created</span><span>{fmtDate(sprint.createdAt)}</span></li>
              <li><span>Closed</span><span>{fmtDate(sprint.closedAt)}</span></li>
            </ul>
          </Card>

          <Card className="sprint-detail__card">
            <div className="sprint-detail__card-title">Members</div>
            {assigneeBreakdown.length === 0 ? (
              <p className="sprint-detail__placeholder">No assignees yet.</p>
            ) : (
              <ul className="sprint-detail__members">
                {assigneeBreakdown.map((a, i) => {
                  const m = a.id ? memberById[a.id] : null;
                  return (
                    <li key={a.id ?? `_none_${i}`} className="sprint-detail__member-row">
                      {m ? (
                        <Avatar src={m.avatarUrl} name={m.fullName} size="xs" />
                      ) : (
                        <span className="sprint-detail__unassigned" title="Unassigned" />
                      )}
                      <span className="truncate">
                        {m ? m.fullName : 'Unassigned'}
                      </span>
                      <span className="mono dim sprint-detail__member-stats">
                        {a.tasks} · {a.points} pts
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="sprint-detail__card">
            <div className="sprint-detail__card-title">Scope baseline</div>
            <p className="sprint-detail__placeholder">
              {sprint.status === 'Planning'
                ? 'Baseline locks when the sprint starts.'
                : 'Baseline captured at start. Scope-delta breakdown lands in Phase 2.'}
            </p>
          </Card>
        </section>
      </div>

      <TaskDetailDrawer
        taskId={openedTaskId}
        projectId={project.id}
        onClose={() => setOpenedTaskId(null)}
        onChanged={() => load(project.id)}
      />
    </div>
  );
}
