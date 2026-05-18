import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useParams } from 'react-router-dom';
import { Link, MessageSquare, Paperclip } from 'lucide-react';
import { Avatar, Priority } from '@/components/ui';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './KanbanCard.css';

// `task.key` is now a real per-project serial like "AT-247", produced by
// the backend from Project.Key + Task.KeyNum. Fall back to a UUID tail
// only if a stale response somehow lacks it (defensive — should not
// happen on the current API).
function shortKey(card) {
  if (card.key) return card.key;
  const id = String(card.taskId ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

export function KanbanCard({ card, onOpen, epic }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card:${card.taskId}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  const assignee = card.assigneeId ? members.find((m) => m.userId === card.assigneeId) : null;

  function handleClick() {
    if (isDragging) return;
    onOpen?.(card.taskId);
  }
  function handleKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen?.(card.taskId);
    }
  }

  const comments = card.commentCount ?? 0;
  const files = card.attachmentCount ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="card kanban-card"
      role="button"
      tabIndex={0}
      aria-label={`${card.title} — ${card.priority} priority`}
    >
      <div className="hstack kanban-card__top">
        <span className="mono dim kanban-card__key">{shortKey(card)}</span>
        <Priority level={card.priority} />
      </div>

      <div className="kanban-card__title">{card.title}</div>

      {epic && (
        <div className="hstack kanban-card__epic" title={epic.title}>
          <span
            className="kanban-card__epic-dot"
            style={{ background: epic.color || 'var(--accent-primary)' }}
          />
          <span className="truncate kanban-card__epic-name">{epic.title}</span>
        </div>
      )}

      {card.blockerKey && (
        <div className="hstack kanban-card__blocker">
          <Link size={11} aria-hidden="true" />
          <span>Blocked by</span>
          <span className="mono">{card.blockerKey}</span>
        </div>
      )}

      <div className="hstack kanban-card__foot">
        {assignee ? (
          <Avatar
            src={assignee.avatarUrl}
            name={assignee.fullName}
            size="xs"
            alt={`Assigned to ${assignee.fullName}`}
          />
        ) : (
          <span className="kanban-card__unassigned" title="Unassigned" />
        )}
        <span className="hstack kanban-card__meta">
          {comments > 0 && (
            <span className="hstack kanban-card__meta-item" title={`${comments} comments`}>
              <MessageSquare size={11} aria-hidden="true" />
              {comments}
            </span>
          )}
          {files > 0 && (
            <span className="hstack kanban-card__meta-item" title={`${files} attachments`}>
              <Paperclip size={11} aria-hidden="true" />
              {files}
            </span>
          )}
          {card.storyPoints != null && (
            <span className="mono kanban-card__pts" title="Story points">
              {card.storyPoints}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
