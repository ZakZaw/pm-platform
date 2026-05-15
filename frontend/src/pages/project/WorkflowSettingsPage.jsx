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
import { GripVertical } from 'lucide-react';
import { Badge, Card, Input, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { workflowApi } from '@/api/workflow.api';
import './WorkflowSettingsPage.css';

const COLOR_OPTIONS = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'info', label: 'Info (blue)' },
  { value: 'purple', label: 'Purple' },
  { value: 'warning', label: 'Warning (amber)' },
  { value: 'danger', label: 'Danger (red)' },
  { value: 'success', label: 'Success (green)' },
];

export function WorkflowSettingsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

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

  if (loading) return <p className="workflow__placeholder">Loading…</p>;
  if (error) return <p className="workflow__placeholder">{error}</p>;

  return (
    <div className="workflow">
      <header className="workflow__header">
        <h1 className="workflow__title">Workflow statuses</h1>
        <p className="workflow__sub">
          Rename, recolor, reorder, and hide the columns that appear on this project's board.
        </p>
      </header>

      <Card className="workflow__card">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
          <SortableContext
            items={configs.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="workflow__list">
              {configs.map((cfg) => (
                <Row key={cfg.id} cfg={cfg} onPatch={(body) => patch(cfg, body)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </Card>
    </div>
  );
}

function Row({ cfg, onPatch }) {
  return <RowInner key={cfg.displayName} cfg={cfg} onPatch={onPatch} />;
}

function RowInner({ cfg, onPatch }) {
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
    <li ref={setNodeRef} style={style} className="workflow__row">
      <button
        type="button"
        className="workflow__handle"
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

      <label className="workflow__toggle">
        <input
          type="checkbox"
          checked={cfg.isVisible}
          onChange={(e) => onPatch({ isVisible: e.target.checked })}
        />
        <span>Show on board</span>
      </label>

      <label className="workflow__toggle">
        <input
          type="checkbox"
          checked={cfg.isDoneState}
          onChange={(e) => onPatch({ isDoneState: e.target.checked })}
        />
        <span>Done state</span>
      </label>

      <span className="workflow__system">{cfg.status}</span>
    </li>
  );
}
