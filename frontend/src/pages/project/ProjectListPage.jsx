import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Columns3, Download, Search, X } from 'lucide-react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  TASK_STATUSES,
  STATUS_LABELS,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { tasksApi } from '@/api/tasks.api';
import { epicsApi } from '@/api/epics.api';
import { sprintsApi } from '@/api/sprints.api';
import './ProjectListPage.css';

const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];

const ALL_COLUMNS = [
  { key: 'key', label: 'Key', sortable: true },
  { key: 'title', label: 'Title', sortable: true, sticky: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'assignee', label: 'Assignee', sortable: true },
  { key: 'epic', label: 'Epic', sortable: true },
  { key: 'sprint', label: 'Sprint', sortable: true },
  { key: 'story_points', label: 'Pts', sortable: true },
  { key: 'due_date', label: 'Due', sortable: true },
  { key: 'created_at', label: 'Created', sortable: true },
];
const DEFAULT_VISIBLE = new Set([
  'key', 'title', 'status', 'priority', 'assignee', 'epic', 'sprint', 'story_points', 'due_date',
]);

export function ProjectListPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [epics, setEpics] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState({
    status: [], priority: [], assigneeId: null, search: '', includeDone: false,
  });
  const [sort, setSort] = useState({ field: 'priority_order', dir: 'asc' });
  const [selection, setSelection] = useState(new Set());

  const [visibleCols, setVisibleCols] = useState(() => loadColumnPrefs() ?? DEFAULT_VISIBLE);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [bulkMenu, setBulkMenu] = useState(null); // 'status' | 'assignee' | 'delete' | null
  const [failureModal, setFailureModal] = useState(null);

  // Initial load: project + supporting data. Tasks reload on filter/sort change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        const [epicsRes, sprintsRes, membersRes] = await Promise.all([
          epicsApi.listForProject(p.id).catch(() => []),
          sprintsApi.listForProject(p.id).catch(() => []),
          projectsApi.listMembers(p.id).catch(() => []),
        ]);
        if (cancelled) return;
        setEpics(epicsRes);
        setSprints(sprintsRes);
        setMembers(membersRes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  const reloadTasks = useCallback(async () => {
    if (!project) return;
    const params = {
      include_done: filter.includeDone,
      sort: `${sort.field}:${sort.dir}`,
    };
    if (filter.status.length) params.status = filter.status;
    if (filter.priority.length) params.priority = filter.priority;
    if (filter.assigneeId) params.assignee_id = filter.assigneeId;
    if (filter.search.trim()) params.search = filter.search.trim();
    try {
      const rows = await tasksApi.listForProject(project.id, params);
      setTasks(rows);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not load tasks.' });
    }
  }, [project, filter, sort, toast]);

  useEffect(() => { reloadTasks(); }, [reloadTasks]);

  // Persist column prefs whenever they change.
  useEffect(() => { saveColumnPrefs(visibleCols); }, [visibleCols]);

  const epicById = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics]);
  const sprintById = useMemo(() => new Map(sprints.map((s) => [s.id, s])), [sprints]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  const toggleColumn = (key) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Don't allow hiding title — it's the spine of the spreadsheet.
      next.add('title');
      return next;
    });
  };

  const toggleSort = (field) => {
    setSort((prev) => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' });
  };

  const allSelected = tasks.length > 0 && selection.size === tasks.length;
  const someSelected = selection.size > 0 && !allSelected;
  const toggleSelectAll = () => {
    setSelection(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
  };
  const toggleSelect = (id) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Inline edit: send PATCH and update the row optimistically. If the
  // request fails, restore the previous value + surface the error.
  const handleCellUpdate = async (task, field, value) => {
    const before = tasks;
    setTasks((rows) => rows.map((t) => t.id === task.id ? { ...t, ...patchPreview(field, value) } : t));
    try {
      if (field === 'status') {
        await tasksApi.changeStatus(task.id, { to: value });
      } else {
        await tasksApi.update(task.id, fieldToBody(field, value));
      }
      await reloadTasks();
    } catch (err) {
      setTasks(before);
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? `Couldn't update ${field}.` });
    }
  };

  const handleBulk = async (operation, payload) => {
    if (!project || selection.size === 0) return;
    try {
      const result = await tasksApi.bulk(project.id, {
        taskIds: [...selection],
        operation,
        payload,
      });
      const successCount = result.succeeded.length;
      const failCount = result.failed.length;
      if (successCount > 0) {
        toast.show({
          tone: failCount === 0 ? 'success' : 'warning',
          message: `Updated ${successCount} task${successCount === 1 ? '' : 's'}${failCount > 0 ? ` · ${failCount} failed` : ''}.`,
        });
      } else if (failCount > 0) {
        toast.show({ tone: 'danger', message: `All ${failCount} updates failed.` });
      }
      if (failCount > 0) setFailureModal({ operation, failures: result.failed });
      setSelection(new Set());
      setBulkMenu(null);
      await reloadTasks();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Bulk update failed.' });
    }
  };

  const exportCsv = () => {
    const cols = ALL_COLUMNS.filter((c) => visibleCols.has(c.key));
    const rows = tasks.map((t) => cols.map((c) => csvCell(t, c.key, { epicById, sprintById, memberById })));
    const headers = cols.map((c) => csvEscape(c.label));
    const body = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.slug ?? 'tasks'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project && loading) {
    return <div className="main-inner"><Skeleton height={400} radius="lg" /></div>;
  }
  if (!project) {
    return <div className="main-inner"><p className="muted">Project not found.</p></div>;
  }

  return (
    <div className="main-inner list-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project.name} · Spreadsheet</div>
            <h1 className="page-title" style={{ fontSize: 'var(--fs-2xl)' }}>List</h1>
            <p className="page-subtitle" style={{ marginTop: 6 }}>
              {tasks.length} task{tasks.length === 1 ? '' : 's'}
              {selection.size > 0 && ` · ${selection.size} selected`}
            </p>
          </div>
          <div className="row gap-3">
            <Button size="sm" onClick={exportCsv} disabled={tasks.length === 0}>
              <Download size={13} aria-hidden="true" /> Export CSV
            </Button>
            <div className="list-page__columns-wrap">
              <Button size="sm" onClick={() => setColumnsOpen((v) => !v)}>
                <Columns3 size={13} aria-hidden="true" /> Columns
              </Button>
              {columnsOpen && (
                <div className="menu list-page__menu" role="menu">
                  <div className="menu-label">Visible columns</div>
                  {ALL_COLUMNS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={visibleCols.has(c.key)}
                      disabled={c.key === 'title'}
                      className={`menu-item ${visibleCols.has(c.key) ? 'is-selected' : ''}`}
                      onClick={() => toggleColumn(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        members={members}
      />

      {selection.size > 0 && (
        <BulkBar
          count={selection.size}
          onClear={() => setSelection(new Set())}
          onAction={(op) => setBulkMenu(op)}
        />
      )}

      <div className="list-page__table-wrap">
        <table className="tbl tbl-clean list-page__table">
          <thead>
            <tr>
              <th className="list-page__check-col">
                <input
                  type="checkbox"
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                />
              </th>
              {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((c) => (
                <th
                  key={c.key}
                  className={`list-page__th ${c.sortable ? 'is-sortable' : ''}`}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="row gap-1 center">
                    {c.label}
                    {sort.field === c.key && (
                      sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && !loading && (
              <tr>
                <td colSpan={visibleCols.size + 1} className="list-page__empty">
                  No tasks match the current filters.
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                visible={visibleCols}
                selected={selection.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onUpdate={handleCellUpdate}
                epics={epics}
                sprints={sprints}
                members={members}
              />
            ))}
          </tbody>
        </table>
      </div>

      <BulkActionModal
        op={bulkMenu}
        count={selection.size}
        members={members}
        onClose={() => setBulkMenu(null)}
        onConfirm={handleBulk}
      />

      <Modal
        open={!!failureModal}
        onClose={() => setFailureModal(null)}
        labelledBy="bulk-fail-title"
        size="md"
      >
        <ModalHeader>
          <h3 id="bulk-fail-title" className="modal-title">
            Some tasks couldn't be updated
          </h3>
        </ModalHeader>
        <ModalBody>
          <p className="muted">
            {failureModal?.failures.length} task{failureModal?.failures.length === 1 ? '' : 's'} were rejected during the bulk{' '}
            {failureModal?.operation} operation:
          </p>
          <ul className="list-page__failure-list">
            {failureModal?.failures.map((f) => (
              <li key={f.taskId}>
                <span className="mono">{f.taskId.slice(0, 8)}</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setFailureModal(null)}>OK</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function FilterBar({ filter, onChange, members }) {
  const toggleMulti = (key, value) => {
    onChange({
      ...filter,
      [key]: filter[key].includes(value)
        ? filter[key].filter((v) => v !== value)
        : [...filter[key], value],
    });
  };

  return (
    <div className="list-page__filters">
      <div className="list-page__search">
        <Search size={13} aria-hidden="true" />
        <input
          type="search"
          className="input"
          placeholder="Search title…"
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
        />
      </div>
      <div className="row gap-2 wrap">
        {TASK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${filter.status.includes(s) ? 'is-active' : ''}`}
            onClick={() => toggleMulti('status', s)}
          >
            {STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>
      <div className="row gap-2 wrap">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${filter.priority.includes(p) ? 'is-active' : ''}`}
            onClick={() => toggleMulti('priority', p)}
          >
            {p}
          </button>
        ))}
      </div>
      <select
        className="input"
        value={filter.assigneeId ?? ''}
        onChange={(e) => onChange({ ...filter, assigneeId: e.target.value || null })}
      >
        <option value="">Any assignee</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>{m.fullName}</option>
        ))}
      </select>
      <label className="row gap-2 center">
        <input
          type="checkbox"
          checked={filter.includeDone}
          onChange={(e) => onChange({ ...filter, includeDone: e.target.checked })}
        />
        <span className="muted">Include done</span>
      </label>
      {(filter.status.length > 0 || filter.priority.length > 0 || filter.assigneeId || filter.search) && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({ status: [], priority: [], assigneeId: null, search: '', includeDone: filter.includeDone })}
        >
          <X size={12} aria-hidden="true" /> Clear
        </Button>
      )}
    </div>
  );
}

function BulkBar({ count, onClear, onAction }) {
  return (
    <div className="list-page__bulkbar">
      <span><strong>{count}</strong> selected</span>
      <div className="row gap-2">
        <Button size="sm" onClick={() => onAction('status')}>Change status</Button>
        <Button size="sm" onClick={() => onAction('assignee')}>Change assignee</Button>
        <Button size="sm" variant="danger" onClick={() => onAction('delete')}>Delete</Button>
        <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
      </div>
    </div>
  );
}

function TaskRow({ task, visible, selected, onToggleSelect, onUpdate, epics, sprints, members }) {
  return (
    <tr className={selected ? 'is-selected' : undefined}>
      <td className="list-page__check-col">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${task.title}`} />
      </td>
      {visible.has('key') && (
        <td className="list-page__td-mono">
          <span className="mono">{task.key}</span>
        </td>
      )}
      {visible.has('title') && (
        <td>
          <EditableText
            value={task.title}
            placeholder="Untitled"
            onCommit={(v) => v !== task.title && onUpdate(task, 'title', v)}
          />
        </td>
      )}
      {visible.has('status') && (
        <td>
          <select
            className={`list-page__cell-select list-page__status list-page__status--${task.status}`}
            value={task.status}
            onChange={(e) => onUpdate(task, 'status', e.target.value)}
            aria-label="Status"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
        </td>
      )}
      {visible.has('priority') && (
        <td>
          <select
            className={`list-page__cell-select list-page__pri list-page__pri--${task.priority}`}
            value={task.priority}
            onChange={(e) => onUpdate(task, 'priority', e.target.value)}
            aria-label="Priority"
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </td>
      )}
      {visible.has('assignee') && (
        <td>
          <select
            className="list-page__cell-select"
            value={task.assigneeId ?? ''}
            onChange={(e) => onUpdate(task, 'assignee', e.target.value || null)}
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
          </select>
        </td>
      )}
      {visible.has('epic') && (
        <td>
          <select
            className="list-page__cell-select"
            value={task.epicId ?? ''}
            onChange={(e) => onUpdate(task, 'epic', e.target.value || null)}
            aria-label="Epic"
          >
            <option value="">No epic</option>
            {epics.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </td>
      )}
      {visible.has('sprint') && (
        <td>
          <select
            className="list-page__cell-select"
            value={task.sprintId ?? ''}
            onChange={(e) => onUpdate(task, 'sprint', e.target.value || null)}
            aria-label="Sprint"
          >
            <option value="">Backlog</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </td>
      )}
      {visible.has('story_points') && (
        <td>
          <EditableNumber
            value={task.storyPoints ?? ''}
            min={0}
            onCommit={(v) => onUpdate(task, 'storyPoints', v === '' ? null : Number(v))}
          />
        </td>
      )}
      {visible.has('due_date') && (
        <td>
          <input
            type="date"
            className="list-page__cell-input"
            value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
            onChange={(e) => onUpdate(task, 'dueDate', e.target.value || null)}
            aria-label="Due date"
          />
        </td>
      )}
      {visible.has('created_at') && (
        <td className="muted mono">{task.createdAt.slice(0, 10)}</td>
      )}
    </tr>
  );
}

function EditableText({ value, placeholder, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="text"
      className="list-page__cell-input"
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setLocal(value); e.currentTarget.blur(); }
      }}
    />
  );
}

function EditableNumber({ value, min, onCommit }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <input
      type="number"
      className="list-page__cell-input list-page__cell-input--num"
      value={local}
      min={min}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setLocal(value); e.currentTarget.blur(); }
      }}
    />
  );
}

function BulkActionModal({ op, count, members, onClose, onConfirm }) {
  const [status, setStatus] = useState('ToDo');
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  useEffect(() => {
    if (op) { setStatus('ToDo'); setReason(''); setAssigneeId(''); }
  }, [op]);

  if (!op) return null;
  const needsReason = op === 'status' && (status === 'Blocked' || status === 'WontDo');

  return (
    <Modal open onClose={onClose} labelledBy="bulk-title" size="md">
      <ModalHeader>
        <h3 id="bulk-title" className="modal-title">
          {op === 'status' && `Change status for ${count} task${count === 1 ? '' : 's'}`}
          {op === 'assignee' && `Reassign ${count} task${count === 1 ? '' : 's'}`}
          {op === 'delete' && `Delete ${count} task${count === 1 ? '' : 's'}?`}
        </h3>
      </ModalHeader>
      <ModalBody>
        {op === 'status' && (
          <div className="col gap-4">
            <label className="col gap-1">
              <span className="muted">New status</span>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
              </select>
            </label>
            {needsReason && (
              <label className="col gap-1">
                <span className="muted">Reason (required for {status})</span>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            <p className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
              Each task is validated individually. Invalid transitions are reported but don't abort the batch.
            </p>
          </div>
        )}
        {op === 'assignee' && (
          <label className="col gap-1">
            <span className="muted">New assignee</span>
            <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassign</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
            </select>
          </label>
        )}
        {op === 'delete' && (
          <p>
            This permanently removes the selected tasks. Subtasks, comments, and attachments
            are deleted with them.
          </p>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant={op === 'delete' ? 'danger' : 'primary'}
          disabled={op === 'status' && needsReason && !reason.trim()}
          onClick={() => {
            if (op === 'status') onConfirm('status', { status, reason: needsReason ? reason : null });
            else if (op === 'assignee') onConfirm('assignee', {
              assigneeId: assigneeId || null,
              clearAssignee: !assigneeId,
            });
            else onConfirm('delete', null);
          }}
        >
          {op === 'delete' ? 'Delete' : 'Apply'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// ---------- helpers ----------

function patchPreview(field, value) {
  if (field === 'assignee') return { assigneeId: value };
  if (field === 'epic') return { epicId: value };
  if (field === 'sprint') return { sprintId: value };
  if (field === 'storyPoints') return { storyPoints: value };
  if (field === 'dueDate') return { dueDate: value };
  return { [field]: value };
}

function fieldToBody(field, value) {
  switch (field) {
    case 'title': return { title: value };
    case 'priority': return { priority: value };
    case 'storyPoints': return { storyPoints: value };
    case 'epic': return value ? { epicId: value, clearEpic: false } : { epicId: null, clearEpic: true };
    case 'sprint': return value ? { sprintId: value, clearSprint: false } : { sprintId: null, clearSprint: true };
    case 'assignee': return value ? { assigneeId: value, clearAssignee: false } : { assigneeId: null, clearAssignee: true };
    case 'dueDate': return value ? { dueDate: value, clearDueDate: false } : { dueDate: null, clearDueDate: true };
    default: throw new Error(`Unknown field ${field}`);
  }
}

function csvCell(task, key, { epicById, sprintById, memberById }) {
  switch (key) {
    case 'key': return csvEscape(task.key);
    case 'title': return csvEscape(task.title);
    case 'status': return csvEscape(task.status);
    case 'priority': return csvEscape(task.priority);
    case 'assignee': return csvEscape(memberById.get(task.assigneeId)?.fullName ?? '');
    case 'epic': return csvEscape(epicById.get(task.epicId)?.title ?? '');
    case 'sprint': return csvEscape(sprintById.get(task.sprintId)?.name ?? '');
    case 'story_points': return task.storyPoints ?? '';
    case 'due_date': return task.dueDate ? task.dueDate.slice(0, 10) : '';
    case 'created_at': return task.createdAt ? task.createdAt.slice(0, 10) : '';
    default: return '';
  }
}

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLS_KEY = 'pm-platform.list.columns.v1';
function loadColumnPrefs() {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : null;
  } catch { return null; }
}
function saveColumnPrefs(set) {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify([...set]));
  } catch { /* localStorage may be unavailable in some environments */ }
}
