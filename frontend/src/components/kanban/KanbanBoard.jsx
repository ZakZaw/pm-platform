import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
export function KanbanBoard({ board, onChanged, statusConfigs, projectId, defaultSprintId, onOpenTask, epics }) {
  const epicById = (() => {
    const map = {};
    for (const e of epics ?? []) map[e.id] = e;
    return map;
  })();
  const toast = useToast();
  const [optimistic, setOptimistic] = useState(null);
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
          // Status machine may reject the jump (e.g. Backlog → Done). Leave
          // the card in Backlog and let the user drag it.
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

  async function handleDragEnd(e) {
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id).split(':')[1];
    const targetStatus = parseColumnId(String(over.id));
    if (!targetStatus) return;

    let card = null;
    let sourceLane = null;
    let sourceColumn = null;
    for (const lane of displayed.swimlanes) {
      for (const col of lane.columns) {
        const found = col.cards.find((c) => c.taskId === taskId);
        if (found) {
          card = found;
          sourceLane = lane;
          sourceColumn = col;
          break;
        }
      }
      if (card) break;
    }
    if (!card || sourceColumn?.status === targetStatus) return;

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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban">
        {displayed.swimlanes.map((lane) => (
          <div key={lane.key} className="kanban__lane">
            {displayed.swimlanes.length > 1 && (
              <div className="kanban__lane-label">{lane.label}</div>
            )}
            <div className="kanban__columns">
              {lane.columns.map((col) => {
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
    </DndContext>
  );
}

function parseColumnId(id) {
  const parts = id.split(':');
  return parts[0] === 'col' ? parts[1] : null;
}
