import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useToast } from '@/components/ui';
import { tasksApi } from '@/api/tasks.api';
import './KanbanBoard.css';

/**
 * Renders a board with optimistic drag-and-drop. The parent owns the
 * canonical board via the `board` prop; we keep a transient `optimistic`
 * override that shadows it during a drag, and clear back to null on
 * success (after parent refetches) or on error.
 */
export function KanbanBoard({
  board,
  onChanged,
  statusConfigs,
  projectId,
  defaultSprintId,
  onOpenTask,
  epics,
  visibleStatuses,
}) {
  const epicById = (() => {
    const map = {};
    for (const e of epics ?? []) map[e.id] = e;
    return map;
  })();
  const toast = useToast();
  const [optimistic, setOptimistic] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const displayed = optimistic ?? board;

  async function addTaskInColumn(status, title) {
    if (!projectId) return;
    try {
      const created = await tasksApi.create(projectId, {
        title,
        priority: 'Medium',
        sprintId: defaultSprintId ?? undefined,
      });
      // New tasks start in Backlog; if the column isn't Backlog, transition.
      if (status !== created.status) {
        try {
          await tasksApi.changeStatus(created.id, { to: status });
        } catch {
          // Any-to-any transitions are allowed now, so this should succeed.
          // Defensive: leave the card in Backlog if the server still rejects.
        }
      }
      await onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not create task',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function findCard(taskId) {
    for (const lane of displayed.swimlanes) {
      for (const col of lane.columns) {
        const found = col.cards.find((c) => c.taskId === taskId);
        if (found) return { card: found, lane, column: col };
      }
    }
    return null;
  }

  function handleDragStart(e) {
    const taskId = String(e.active.id).split(':')[1];
    const hit = findCard(taskId);
    setActiveCard(hit?.card ?? null);
  }

  async function handleDragEnd(e) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id).split(':')[1];
    const targetStatus = parseColumnId(String(over.id));
    if (!targetStatus) return;

    const hit = findCard(taskId);
    if (!hit || hit.column.status === targetStatus) return;
    const { card, lane: sourceLane, column: sourceColumn } = hit;

    const next = {
      ...displayed,
      swimlanes: displayed.swimlanes.map((lane) =>
        lane !== sourceLane ? lane : {
          ...lane,
          columns: lane.columns.map((col) => {
            if (col === sourceColumn) {
              return { ...col, cards: col.cards.filter((c) => c.taskId !== taskId) };
            }
            if (col.status === targetStatus) {
              return { ...col, cards: [...col.cards, { ...card, status: targetStatus }] };
            }
            return col;
          }),
        },
      ),
    };
    setOptimistic(next);

    try {
      await tasksApi.changeStatus(taskId, { to: targetStatus });
      await onChanged?.();
      setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      toast.show({
        tone: 'danger',
        title: 'Could not move task',
        message: err.response?.data?.detail ?? 'Server rejected the transition.',
      });
    }
  }

  function isVisible(status) {
    if (!visibleStatuses || visibleStatuses.size === 0) return true;
    return visibleStatuses.has(status);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-wrap">
        {displayed.swimlanes.map((lane) => (
          <div key={lane.key} className="kanban-lane">
            {displayed.swimlanes.length > 1 && (
              <div className="kanban-lane-label">{lane.label}</div>
            )}
            <div className="kanban">
              {lane.columns.filter((col) => isVisible(col.status)).map((col) => {
                const cfg = statusConfigs?.find((c) => c.status === col.status);
                const pts = col.cards.reduce((s, c) => s + (c.storyPoints ?? 0), 0);
                return (
                  <KanbanColumn
                    key={col.status}
                    status={col.status}
                    count={col.cards.length}
                    points={pts > 0 ? pts : null}
                    displayName={cfg?.displayName}
                    tone={cfg?.color}
                    wipLimit={cfg?.wipLimit ?? null}
                    onAddTask={projectId ? (title) => addTaskInColumn(col.status, title) : undefined}
                  >
                    {col.cards.map((card) => (
                      <KanbanCard
                        key={card.taskId}
                        card={card}
                        onOpen={onOpenTask}
                        epic={card.epicId ? epicById[card.epicId] : null}
                      />
                    ))}
                  </KanbanColumn>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* DragOverlay paints the dragged card above every column, so it
          never gets clipped by a column's scroll container while the
          pointer hovers between columns. */}
      <DragOverlay dropAnimation={null} zIndex={2000}>
        {activeCard ? (
          <KanbanCard
            card={activeCard}
            epic={activeCard.epicId ? epicById[activeCard.epicId] : null}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function parseColumnId(id) {
  const parts = id.split(':');
  return parts[0] === 'col' ? parts[1] : null;
}
