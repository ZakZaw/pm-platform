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

export function KanbanCard({ card, onOpen, epic, isOverlay = false }) {
  const { slug: orgSlug } = useParams();
  const { members } = useOrgMembers(orgSlug);
  const draggable = useDraggable({
    id: `card:${card.taskId}`,
    disabled: isOverlay,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } = draggable;
  const style = isOverlay
    ? { boxShadow: 'var(--shadow-lg)' }
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
      className="card-task"
      role={isOverlay ? undefined : 'button'}
      tabIndex={isOverlay ? undefined : 0}
      aria-label={`${card.title} — ${card.priority} priority`}
    >
      <div className="card-task-head">
        {epic ? (
          <span
            className="badge card-task-epic-badge"
            style={{
              background: epic.color ? `color-mix(in srgb, ${epic.color} 12%, transparent)` : 'var(--surface-2)',
              color: epic.color || 'var(--text-secondary)',
              borderColor: epic.color ? `color-mix(in srgb, ${epic.color} 35%, transparent)` : 'var(--border-subtle)',
            }}
            title={epic.title}
          >
            <span className="truncate" style={{ maxWidth: 120 }}>{epic.title}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="card-task-id">{shortKey(card)}</span>
      </div>

      <div className="card-task-title">{card.title}</div>

      {card.blockerKey && (
        <div className="card-task-blocker">
          <Link size={11} aria-hidden="true" />
          <span>Blocked by</span>
          <span className="mono">{card.blockerKey}</span>
        </div>
      )}

      <div className="card-task-meta">
        <Priority level={card.priority} />
        {comments > 0 && (
          <span className="row gap-1" title={`${comments} comments`}>
            <MessageSquare size={11} aria-hidden="true" />
            {comments}
          </span>
        )}
        {files > 0 && (
          <span className="row gap-1" title={`${files} attachments`}>
            <Paperclip size={11} aria-hidden="true" />
            {files}
          </span>
        )}
        <span className="meta-spacer" />
        {card.storyPoints != null && (
          <span className="card-task-est" title="Story points">
            {card.storyPoints}p
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
          <span className="card-task-unassigned" title="Unassigned" />
        )}
      </div>
    </div>
  );
}
