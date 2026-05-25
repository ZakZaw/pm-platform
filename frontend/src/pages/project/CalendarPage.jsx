import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  Button,
  Segmented,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { tasksApi } from '@/api/tasks.api';
import { sprintsApi } from '@/api/sprints.api';
import { apiClient } from '@/api/client';
import { ContentCalendarPage } from './ContentCalendarPage';
import './CalendarPage.css';

// F2-03 — universal calendar entry point. Marketing keeps its
// asset-centric ContentCalendarPage (different domain shape); every other
// project type renders TaskCalendarView, which shows tasks with due_dates
// against the project's sprint bands.
export function CalendarPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (!cancelled) setProject(p);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  if (loading && !project) {
    return <div className="main-inner"><Skeleton height={400} radius="lg" /></div>;
  }
  if (!project) {
    return <div className="main-inner"><p className="muted">Project not found.</p></div>;
  }

  // Marketing's content calendar is a separate domain (assets keyed by
  // publish-date + channel). Let it own its own page — we only dispatch.
  if (project.type === 'Marketing') return <ContentCalendarPage />;

  return <TaskCalendarView project={project} />;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SPRINT_TONES = ['sprint-tint-a', 'sprint-tint-b', 'sprint-tint-c', 'sprint-tint-d'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function buildMonthCells(anchor) {
  const first = startOfMonth(anchor);
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(cursor);
    cells.push({
      date: d,
      ymd: ymd(d),
      inMonth: d.getMonth() === anchor.getMonth(),
      isToday: ymd(d) === ymd(new Date()),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function buildWeekCells(anchor) {
  const cursor = new Date(anchor);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(cursor);
    cells.push({
      date: d,
      ymd: ymd(d),
      inMonth: true,
      isToday: ymd(d) === ymd(new Date()),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function TaskCalendarView({ project }) {
  const toast = useToast();
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const cells = useMemo(
    () => view === 'month' ? buildMonthCells(anchor) : buildWeekCells(anchor),
    [view, anchor]);

  const range = useMemo(() => {
    if (cells.length === 0) return null;
    return { start: cells[0].date, end: cells[cells.length - 1].date };
  }, [cells]);

  const reload = useCallback(async () => {
    if (!project || !range) return;
    setLoading(true);
    try {
      const [taskRows, sprintRows] = await Promise.all([
        tasksApi.listForProject(project.id, {
          include_done: true,
          due_after: range.start.toISOString(),
          due_before: new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1).toISOString(),
        }),
        sprintsApi.listForProject(project.id).catch(() => []),
      ]);
      setTasks(taskRows.filter((t) => t.dueDate));
      setSprints(sprintRows);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not load calendar.' });
    } finally {
      setLoading(false);
    }
  }, [project, range, toast]);

  useEffect(() => { reload(); }, [reload]);

  // For each cell ymd, the tasks due that day and the sprint covering it
  // (first match wins — overlapping sprints are rare in practice).
  const tasksByDay = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const key = t.dueDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [tasks]);

  const sprintToneFor = useCallback((day) => {
    for (let i = 0; i < sprints.length; i++) {
      const s = sprints[i];
      if (!s.startDate || !s.endDate) continue;
      if (day >= s.startDate.slice(0, 10) && day <= s.endDate.slice(0, 10)) {
        return { tone: SPRINT_TONES[i % SPRINT_TONES.length], name: s.name, status: s.status };
      }
    }
    return null;
  }, [sprints]);

  const movePeriod = (delta) => {
    const next = new Date(anchor);
    if (view === 'month') next.setMonth(anchor.getMonth() + delta);
    else next.setDate(anchor.getDate() + delta * 7);
    setAnchor(next);
  };

  const goToday = () => {
    setAnchor(view === 'month' ? startOfMonth(new Date()) : new Date());
  };

  const handleDragEnd = async (e) => {
    setDraggingId(null);
    const taskId = e.active?.id;
    const target = e.over?.id;
    if (!taskId || !target) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.dueDate?.slice(0, 10) === target) return;

    const before = tasks;
    setTasks((rows) => rows.map((t) => t.id === taskId ? { ...t, dueDate: `${target}T00:00:00Z` } : t));
    try {
      await tasksApi.update(taskId, { dueDate: target, clearDueDate: false });
      toast.show({ tone: 'success', message: `Rescheduled to ${target}.` });
    } catch (err) {
      setTasks(before);
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not reschedule.' });
    }
  };

  const downloadIcal = async () => {
    try {
      const r = await apiClient.get(`/projects/${project.id}/calendar.ics`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.slug}-calendar.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not download .ics.' });
    }
  };

  const periodLabel = view === 'month'
    ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `Week of ${cells[0]?.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  const draggingTask = draggingId ? tasks.find((t) => t.id === draggingId) : null;

  return (
    <div className="main-inner calendar-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name} · Calendar</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>{periodLabel}</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              Drag a task to reschedule its due date.
            </p>
          </div>
          <div className="row gap-3">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ]}
              ariaLabel="Calendar view"
            />
            <div className="row gap-1">
              <Button size="sm" onClick={() => movePeriod(-1)} aria-label="Previous">
                <ChevronLeft size={14} aria-hidden="true" />
              </Button>
              <Button size="sm" onClick={goToday}>Today</Button>
              <Button size="sm" onClick={() => movePeriod(1)} aria-label="Next">
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
            <Button size="sm" onClick={downloadIcal}>
              <Download size={13} aria-hidden="true" /> .ics
            </Button>
          </div>
        </div>
      </div>

      {sprints.length > 0 && (
        <div className="calendar-page__legend">
          {sprints.slice(0, SPRINT_TONES.length).map((s, i) => (
            <span key={s.id} className="row gap-2 center">
              <span className={`calendar-page__swatch ${SPRINT_TONES[i]}`} />
              <span className="muted">{s.name}</span>
            </span>
          ))}
          {sprints.length > SPRINT_TONES.length && (
            <span className="muted">+{sprints.length - SPRINT_TONES.length} more sprints</span>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDraggingId(e.active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className={`cal calendar-page__grid ${view === 'week' ? 'is-week' : ''}`}>
          <div className="cal-head">
            {DAY_NAMES.map((n) => <div key={n} className="cal-head-cell">{n}</div>)}
          </div>
          <div className={`cal-grid ${view === 'week' ? 'is-week' : ''}`}>
            {cells.map((c) => (
              <DayCell
                key={c.ymd}
                cell={c}
                tasks={tasksByDay.get(c.ymd) ?? []}
                sprint={sprintToneFor(c.ymd)}
                view={view}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {draggingTask && <TaskChip task={draggingTask} dragging />}
        </DragOverlay>
      </DndContext>

      {loading && tasks.length === 0 && <Skeleton height={200} radius="md" />}
    </div>
  );
}

function DayCell({ cell, tasks, sprint, view }) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.ymd });
  const classes = [
    'cal-cell',
    !cell.inMonth ? 'is-other' : '',
    cell.isToday ? 'is-today' : '',
    isOver ? 'is-over' : '',
    sprint ? `calendar-page__cell ${sprint.tone}` : '',
    view === 'week' ? 'calendar-page__cell--week' : '',
  ].filter(Boolean).join(' ');
  return (
    <div ref={setNodeRef} className={classes}>
      <div className="row between center" style={{ marginBottom: 4 }}>
        <span className="cal-date">{cell.date.getDate()}</span>
        {sprint && view === 'week' && (
          <span className="calendar-page__sprint-label muted truncate">{sprint.name}</span>
        )}
      </div>
      <div className="col gap-1">
        {tasks.slice(0, view === 'week' ? 12 : 3).map((t) => (
          <DraggableTaskChip key={t.id} task={t} />
        ))}
        {tasks.length > (view === 'week' ? 12 : 3) && (
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
            +{tasks.length - (view === 'week' ? 12 : 3)} more
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableTaskChip({ task }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cal-event calendar-page__task task-status-${task.status} ${isDragging ? 'is-dragging' : ''}`}
      title={`${task.key} · ${task.title} (${task.status})`}
    >
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function TaskChip({ task, dragging }) {
  return (
    <div className={`cal-event calendar-page__task task-status-${task.status} ${dragging ? 'is-dragging-overlay' : ''}`}>
      <span className="truncate">{task.title}</span>
    </div>
  );
}
