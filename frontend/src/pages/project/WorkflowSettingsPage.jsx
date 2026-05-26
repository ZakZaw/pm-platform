import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { workflowApi } from '@/api/workflow.api';
import { useConfirm } from '@/hooks/useConfirm';
import './WorkflowSettingsPage.css';

const COLOR_OPTIONS = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'info', label: 'Info (blue)' },
  { value: 'purple', label: 'Purple' },
  { value: 'warning', label: 'Warning (amber)' },
  { value: 'danger', label: 'Danger (red)' },
  { value: 'success', label: 'Success (green)' },
];

const BASE_STATUS_OPTIONS = [
  { value: 'Backlog', label: 'Backlog (waiting)' },
  { value: 'ToDo', label: 'To do (ready)' },
  { value: 'InProgress', label: 'In progress (active)' },
  { value: 'InReview', label: 'In review' },
  { value: 'Blocked', label: 'Blocked' },
  { value: 'Done', label: 'Done (terminal)' },
  { value: 'WontDo', label: "Won't do (terminal)" },
];

export function WorkflowSettingsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [project, setProject] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const refresh = useCallback(async (projectId) => {
    const data = await workflowApi.list(projectId);
    setConfigs(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load workflow settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, projectSlug, refresh]);

  async function handleReorder(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = configs.findIndex((c) => c.id === active.id);
    const newIndex = configs.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(configs, oldIndex, newIndex);
    setConfigs(reordered);
    try {
      const saved = await workflowApi.reorder(project.id, reordered.map((c) => c.id));
      setConfigs(saved);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not save order.',
      });
      refresh(project.id).catch(() => {});
    }
  }

  async function patch(cfg, body) {
    try {
      const saved = await workflowApi.update(project.id, cfg.id, body);
      setConfigs((cur) => cur.map((c) => (c.id === saved.id ? saved : c)));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not update status.',
      });
    }
  }

  async function addStatus(body) {
    try {
      const created = await workflowApi.create(project.id, body);
      setConfigs((cur) => [...cur, created]);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not add status.',
      });
    }
  }

  async function deleteStatus(cfg) {
    const ok = await confirm({
      title: `Delete "${cfg.displayName}"?`,
      message: 'Tasks currently in this status will fall back to the underlying base status. This cannot be undone.',
      confirmLabel: 'Delete status',
    });
    if (!ok) return;
    try {
      await workflowApi.remove(project.id, cfg.id);
      setConfigs((cur) => cur.filter((c) => c.id !== cfg.id));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not delete status.',
      });
    }
  }

  if (loading) return <div className="main-inner"><p className="muted">Loading…</p></div>;
  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner workflow">
      {dialog}
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{project?.name ?? 'Project'} · Settings</div>
            <h1 className="page-title">Workflow statuses</h1>
            <div className="page-subtitle">
              Rename, recolor, reorder, and hide the columns that appear on this project's board.
            </div>
          </div>
        </div>
      </div>

      <Card className="workflow-card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
          <SortableContext
            items={configs.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="workflow-list">
              {configs.map((cfg) => (
                <Row
                  key={cfg.id}
                  cfg={cfg}
                  onPatch={(body) => patch(cfg, body)}
                  onDelete={() => deleteStatus(cfg)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>

      <AddStatusCard onAdd={addStatus} />
    </div>
  );
}

function AddStatusCard({ onAdd }) {
  const [name, setName] = useState('');
  const [base, setBase] = useState('ToDo');
  const [color, setColor] = useState('neutral');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (name.trim().length < 1 || busy) return;
    setBusy(true);
    try {
      await onAdd({ baseStatus: base, displayName: name.trim(), color, isDoneState: false });
      setName('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="workflow-card" title="Add a status">
      <form className="workflow-add" onSubmit={submit}>
        <Input
          label="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Verifying"
          maxLength={60}
        />
        <Select
          label="Behaves like"
          options={BASE_STATUS_OPTIONS}
          value={base}
          onChange={(e) => setBase(e.target.value)}
          help="Maps to the state-machine bucket tasks transition between."
        />
        <Select
          label="Color"
          options={COLOR_OPTIONS}
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Button type="submit" disabled={busy || name.trim().length < 1}>
          <Plus size={14} aria-hidden="true" /> Add status
        </Button>
      </form>
    </Card>
  );
}

function Row({ cfg, onPatch, onDelete }) {
  return <RowInner key={cfg.displayName} cfg={cfg} onPatch={onPatch} onDelete={onDelete} />;
}

// PM-21 WIP limit per-column. Empty input clears the cap; positive numbers
// set it. The board uses this advisory limit to flag overflowing columns —
// it does not block transitions.
function WipLimitInput({ cfg, onPatch }) {
  const [value, setValue] = useState(cfg.wipLimit == null ? '' : String(cfg.wipLimit));
  useEffect(() => {
    setValue(cfg.wipLimit == null ? '' : String(cfg.wipLimit));
  }, [cfg.wipLimit]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === '') {
      if (cfg.wipLimit == null) return;
      onPatch({ clearWipLimit: true });
      return;
    }
    const n = parseInt(trimmed, 10);
    if (Number.isNaN(n) || n <= 0) {
      setValue(cfg.wipLimit == null ? '' : String(cfg.wipLimit));
      return;
    }
    if (n === cfg.wipLimit) return;
    onPatch({ wipLimit: n });
  }

  return (
    <label className="workflow-toggle workflow-wip" title="WIP limit (blank = no limit)">
      <span className="muted">WIP</span>
      <input
        type="number"
        min={1}
        className="input workflow-wip__input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        aria-label={`WIP limit for ${cfg.displayName}`}
      />
    </label>
  );
}

function RowInner({ cfg, onPatch, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cfg.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  // Local edit buffer for the display-name input. Remount via the parent's
  // `key` whenever cfg.displayName changes server-side, so we don't need a
  // useEffect to sync from props.
  const [name, setName] = useState(cfg.displayName);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === cfg.displayName) {
      setName(cfg.displayName);
      return;
    }
    onPatch({ displayName: trimmed });
  };

  return (
    <li ref={setNodeRef} style={style} className="workflow-row">
      <button
        type="button"
        className="workflow-handle"
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>

      <Badge tone={cfg.color}>{cfg.displayName}</Badge>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitName();
          }
        }}
        aria-label={`Display name for ${cfg.status}`}
      />

      <Select
        options={COLOR_OPTIONS}
        value={cfg.color}
        onChange={(e) => onPatch({ color: e.target.value })}
        aria-label={`Color for ${cfg.displayName}`}
      />

      <label className="workflow-toggle">
        <input
          type="checkbox"
          checked={cfg.isVisible}
          onChange={(e) => onPatch({ isVisible: e.target.checked })}
        />
        <span>Show on board</span>
      </label>

      <label className="workflow-toggle">
        <input
          type="checkbox"
          checked={cfg.isDoneState}
          onChange={(e) => onPatch({ isDoneState: e.target.checked })}
        />
        <span>Done state</span>
      </label>

      <WipLimitInput cfg={cfg} onPatch={onPatch} />

      <span className="workflow-system">{cfg.status}</span>

      <button
        type="button"
        className="workflow-delete"
        onClick={onDelete}
        aria-label={`Delete ${cfg.displayName}`}
        title="Delete this column"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
