import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Badge, Button, Card, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { boardApi } from '@/api/board.api';
import { sprintsApi } from '@/api/sprints.api';
import './BacklogPage.css';

export function BacklogPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [stories, setStories] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [sprintStories, setSprintStories] = useState([]);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (projectId) => {
    const [bl, active] = await Promise.all([
      boardApi.backlog(projectId),
      sprintsApi.getActive(projectId),
    ]);
    setStories(bl);
    setActiveSprint(active);
    if (active) {
      const board = await boardApi.get(projectId, { sprintId: active.id });
      const cards = board.swimlanes.flatMap((l) => l.columns.flatMap((c) => c.cards));
      setSprintStories(cards);
    } else {
      setSprintStories([]);
    }
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
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load backlog.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sprintTotal = useMemo(
    () => sprintStories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0),
    [sprintStories],
  );

  async function handleReorder(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stories.findIndex((s) => s.id === active.id);
    const newIndex = stories.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(stories, oldIndex, newIndex);
    setStories(reordered);
    try {
      await boardApi.reorderBacklog(project.id, reordered.map((s) => s.id));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not save order.',
      });
      await refresh(project.id);
    }
  }

  async function addToSprint(storyId) {
    if (!activeSprint) {
      toast.show({ tone: 'info', message: 'Start or create a sprint first.' });
      return;
    }
    try {
      await sprintsApi.addStory(activeSprint.id, storyId);
      await refresh(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not add to sprint.',
      });
    }
  }

  async function removeFromSprint(storyId) {
    try {
      await sprintsApi.removeStory(storyId);
      await refresh(project.id);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove from sprint.',
      });
    }
  }

  if (error) return <p className="backlog-page__placeholder">{error}</p>;
  if (!project) return <p className="backlog-page__placeholder">Loading…</p>;

  return (
    <div className="backlog-page">
      <header className="backlog-page__header">
        <h1 className="backlog-page__title">Backlog</h1>
      </header>

      <div className="backlog-page__grid">
        <Card className="backlog-page__list">
          <header className="backlog-page__list-head">
            <h2 className="backlog-page__list-title">Stories</h2>
            <span className="backlog-page__count">{stories.length}</span>
          </header>
          {stories.length === 0 ? (
            <p className="backlog-page__placeholder">No backlog stories.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
              <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="backlog-page__items">
                  {stories.map((s) => (
                    <BacklogItem key={s.id} story={s} onAdd={() => addToSprint(s.id)} canAdd={Boolean(activeSprint)} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </Card>

        <Card className="backlog-page__sprint">
          <header className="backlog-page__sprint-head">
            <h2 className="backlog-page__list-title">Active sprint</h2>
            {activeSprint && (
              <span className="backlog-page__count">{sprintStories.length} · {sprintTotal} pts</span>
            )}
          </header>
          {activeSprint ? (
            <>
              <div className="backlog-page__sprint-name">{activeSprint.name}</div>
              {activeSprint.goal && (
                <p className="backlog-page__sprint-goal">{activeSprint.goal}</p>
              )}
              {sprintStories.length === 0 ? (
                <p className="backlog-page__placeholder">No stories yet. Add some from the left.</p>
              ) : (
                <ul className="backlog-page__items">
                  {sprintStories.map((s) => (
                    <li key={s.storyId} className="backlog-page__sprint-item">
                      <span className="backlog-page__item-title">{s.title}</span>
                      <div className="backlog-page__item-meta">
                        {s.storyPoints != null && <Badge tone="purple">{s.storyPoints}</Badge>}
                        <Button size="sm" variant="ghost" onClick={() => removeFromSprint(s.storyId)}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="backlog-page__placeholder">
              No active sprint. Create one on the sprints page.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function BacklogItem({ story, onAdd, canAdd }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="backlog-page__item">
      <button type="button" className="backlog-page__handle" {...listeners} {...attributes} aria-label="Drag to reorder">
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className="backlog-page__item-title">{story.title}</span>
      <div className="backlog-page__item-meta">
        <Badge tone="info">{story.priority}</Badge>
        {story.storyPoints != null && <Badge tone="purple">{story.storyPoints}</Badge>}
        {canAdd && (
          <Button size="sm" variant="ghost" onClick={onAdd}>Add to sprint</Button>
        )}
      </div>
    </li>
  );
}
