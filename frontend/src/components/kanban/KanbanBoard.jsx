import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { useToast } from '@/components/ui';
import { storiesApi } from '@/api/stories.api';
import './KanbanBoard.css';

/**
 * Renders a board with optimistic drag-and-drop. The parent owns the
 * canonical board via the `board` prop; we keep a transient `optimistic`
 * override that shadows it during a drag, and clear back to null on
 * success (after parent refetches) or on error.
 */
export function KanbanBoard({ board, onChanged, statusConfigs }) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useState(null);
  const displayed = optimistic ?? board;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(e) {
    const { active, over } = e;
    if (!over) return;
    const storyId = String(active.id).split(':')[1];
    const targetStatus = parseColumnId(String(over.id));
    if (!targetStatus) return;

    let card = null;
    let sourceLane = null;
    let sourceColumn = null;
    for (const lane of displayed.swimlanes) {
      for (const col of lane.columns) {
        const found = col.cards.find((c) => c.storyId === storyId);
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
              return { ...col, cards: col.cards.filter((c) => c.storyId !== storyId) };
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
      await storiesApi.changeStatus(storyId, { to: targetStatus });
      // Parent re-fetches via onChanged; clear the overlay so the new prop
      // becomes the source of truth.
      await onChanged?.();
      setOptimistic(null);
    } catch (err) {
      setOptimistic(null);
      toast.show({
        tone: 'danger',
        title: 'Could not move story',
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
                return (
                  <KanbanColumn
                    key={col.status}
                    status={col.status}
                    count={col.cards.length}
                    displayName={cfg?.displayName}
                    tone={cfg?.color}
                  >
                    {col.cards.map((card) => (
                      <KanbanCard key={card.storyId} card={card} />
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
