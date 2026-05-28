import { useState } from 'react';
import { MessageSquare, MoreHorizontal, Pencil, SmilePlus, Trash2, X } from 'lucide-react';
import { Avatar, Button, Dropdown } from '@/components/ui';
import { emojiGlyph, QUICK_EMOJI, renderMessageBody } from './messageMarkdown';

/**
 * One row in a chat feed. Renders a deleted message as a "(deleted)"
 * stub instead of unmounting it so reply counts stay coherent. When
 * the caller is the author, hover affordances reveal Edit / Delete; a
 * reaction popover sits in the same hover row so the picker doesn't
 * push the layout around.
 */
export function MessageItem({
  message, currentUserId, orgSlug,
  onReply, onEdit, onDelete, onToggleReaction,
  inThread = false,
}) {
  const isAuthor = message.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.bodyMd);
  const [showEmoji, setShowEmoji] = useState(false);

  function startEdit() {
    setDraft(message.bodyMd);
    setEditing(true);
  }
  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.bodyMd) {
      setEditing(false);
      return;
    }
    await onEdit?.(message.id, trimmed);
    setEditing(false);
  }

  return (
    <article className={['msg-row', message.isDeleted && 'is-deleted'].filter(Boolean).join(' ')}>
      <Avatar src={message.authorAvatarUrl} name={message.authorName || message.authorEmail} size="sm" />
      <div className="msg-body">
        <header className="msg-meta">
          <span className="msg-author">{message.authorName || message.authorEmail}</span>
          <time className="msg-time">{formatStamp(message.createdAt)}</time>
          {message.editedAt && !message.isDeleted && (
            <span className="msg-edited" title={new Date(message.editedAt).toLocaleString()}>(edited)</span>
          )}
        </header>

        {message.isDeleted ? (
          <p className="msg-deleted">(this message was deleted)</p>
        ) : editing ? (
          <div className="msg-edit-row">
            <textarea
              className="msg-edit-input"
              value={draft}
              autoFocus
              rows={Math.min(8, Math.max(2, draft.split('\n').length))}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
            <div className="row gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="primary" onClick={saveEdit}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="msg-text">{renderMessageBody(message.bodyMd, { orgSlug })}</div>
        )}

        {!message.isDeleted && message.reactions?.length > 0 && (
          <div className="msg-reactions">
            {message.reactions.map((r) => {
              const mine = r.userIds.includes(currentUserId);
              return (
                <button
                  key={r.emoji}
                  type="button"
                  className={['msg-react', mine && 'is-mine'].filter(Boolean).join(' ')}
                  onClick={() => onToggleReaction?.(message.id, r.emoji)}
                  title={`${r.count} reacted with ${r.emoji}`}
                >
                  <span aria-hidden="true">{emojiGlyph(r.emoji)}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {!inThread && !message.isDeleted && message.replyCount > 0 && (
          <button
            type="button"
            className="msg-thread-link"
            onClick={() => onReply?.(message)}
          >
            <MessageSquare size={11} aria-hidden="true" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            {message.lastReplyAt && (
              <span className="muted"> · last {formatRelative(message.lastReplyAt)}</span>
            )}
          </button>
        )}
      </div>

      {!message.isDeleted && (
        <div className="msg-actions">
          <button
            type="button"
            className="msg-action-btn"
            onClick={() => setShowEmoji((s) => !s)}
            aria-label="Add reaction"
            title="Add reaction"
          >
            <SmilePlus size={12} aria-hidden="true" />
          </button>
          {!inThread && (
            <button
              type="button"
              className="msg-action-btn"
              onClick={() => onReply?.(message)}
              aria-label="Reply in thread"
              title="Reply in thread"
            >
              <MessageSquare size={12} aria-hidden="true" />
            </button>
          )}
          {isAuthor && (
            <Dropdown
              align="end"
              trigger={(
                <button type="button" className="msg-action-btn" aria-label="More actions">
                  <MoreHorizontal size={12} aria-hidden="true" />
                </button>
              )}
            >
              <Dropdown.Item onSelect={startEdit} icon={<Pencil size={11} aria-hidden="true" />}>
                Edit
              </Dropdown.Item>
              <Dropdown.Item
                onSelect={() => onDelete?.(message.id)}
                danger
                icon={<Trash2 size={11} aria-hidden="true" />}
              >
                Delete
              </Dropdown.Item>
            </Dropdown>
          )}

          {showEmoji && (
            <div className="msg-emoji-popover" role="dialog" aria-label="Pick a reaction">
              <button
                type="button"
                className="msg-emoji-close"
                onClick={() => setShowEmoji(false)}
                aria-label="Close"
              >
                <X size={10} aria-hidden="true" />
              </button>
              <div className="msg-emoji-grid">
                {QUICK_EMOJI.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className="msg-emoji-pick"
                    onClick={() => {
                      onToggleReaction?.(message.id, code);
                      setShowEmoji(false);
                    }}
                    title={code}
                  >
                    {emojiGlyph(code)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function formatStamp(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: 'short', day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
