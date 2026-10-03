import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useParams } from 'react-router-dom';
import { Link, MessageSquare, Paperclip } from 'lucide-react';
import { Avatar, Priority } from '@/components/ui';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './KanbanCard.css';

function shortKey(card) {
  if (card.key) return card.key;
  const id = String(card.taskId ?? '');
  return id ? id.slice(0, 4).toUpperCase() : '—';
}

/**
 * Board card. Calm hierarchy: epic (coloured dot + small text) and key on
 * top, the title as the one strong element, then a quiet meta row
 * (priority flag, comment/file counts, points, assignee).
 */
export function KanbanCard({ card, onOpen, epic, isOverlay = false }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const draggable = useDraggable({
    id: `card:${card.taskId}`,
    disabled: isOverlay,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } = draggable;
  // Drag transform is per-frame dynamic, so it has to stay inline.
  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        pointerEvents: isDragging ? 'none' : undefined,
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
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      onClick={isOverlay ? undefined : handleClick}
      onKeyDown={isOverlay ? undefined : handleKey}
      className={['card-task', 'kanban-card', isOverlay ? 'is-overlay' : ''].filter(Boolean).join(' ')}
      role={isOverlay ? undefined : 'button'}
      tabIndex={isOverlay ? undefined : 0}
      aria-label={`${card.title} — ${card.priority} priority`}
    >
      <div className="kanban-card-top">
        {epic ? (
          <span
            className="kanban-card-epic"
            // Epic colour is user data — passed as a custom property, styled in CSS.
            style={epic.color ? { '--epic-color': epic.color } : undefined}
            title={`Epic: ${epic.title}`}
          >
            <span className="truncate">{epic.title}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="card-task-id">{shortKey(card)}</span>
      </div>

      <div className="kanban-card-title">{card.title}</div>

      {card.blockerKey && (
        <div className="kanban-card-blocker">
          <Link size={12} aria-hidden="true" />
          <span>Blocked by</span>
          <span className="mono">{card.blockerKey}</span>
        </div>
      )}

      <div className="kanban-card-meta">
        <Priority level={card.priority} />
        {comments > 0 && (
          <span className="kanban-card-count" title={`${comments} comments`}>
            <MessageSquare size={12} aria-hidden="true" />
            {comments}
          </span>
        )}
        {files > 0 && (
          <span className="kanban-card-count" title={`${files} attachments`}>
            <Paperclip size={12} aria-hidden="true" />
            {files}
          </span>
        )}
        <span className="fill" />
        {card.storyPoints != null && (
          <span className="kanban-card-pts" title="Story points">
            {card.storyPoints} pts
          </span>
        )}
        {assignee ? (
          <Avatar
            src={assignee.avatarUrl}
            name={assignee.fullName}
            size="xs"
            alt={`Assigned to ${assignee.fullName}`}
          />
        ) : (
          <span className="kanban-card-unassigned" title="Unassigned" aria-label="Unassigned" />
        )}
      </div>
    </div>
  );
}
