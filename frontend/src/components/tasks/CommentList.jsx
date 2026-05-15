import { Fragment, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Avatar, useToast } from '@/components/ui';
import { commentsApi } from '@/api/comments.api';
import { useAuthStore } from '@/store/authStore';
import { CommentInput } from './CommentInput';
import './CommentList.css';

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

function renderBody(body) {
  // Split the markdown body into plain segments and mention tokens so we
  // can style mentions as chips. Other markdown stays as plain text in
  // this Phase 1 iteration — proper markdown rendering lands later.
  const out = [];
  let lastIndex = 0;
  for (const m of body.matchAll(MENTION_TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > lastIndex) {
      out.push(<Fragment key={out.length}>{body.slice(lastIndex, start)}</Fragment>);
    }
    out.push(
      <span key={out.length} className="comment__mention">
        @{m[1]}
      </span>,
    );
    lastIndex = start + m[0].length;
  }
  if (lastIndex < body.length) {
    out.push(<Fragment key={out.length}>{body.slice(lastIndex)}</Fragment>);
  }
  return out;
}

function formatTime(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CommentList({ projectId, comments, onChanged }) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);

  async function save(id, body) {
    try {
      await commentsApi.update(id, body);
      toast.show({ tone: 'success', message: 'Comment updated.' });
      setEditingId(null);
      await onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not update comment.',
      });
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await commentsApi.remove(id);
      await onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not delete comment.',
      });
    }
  }

  if (comments.length === 0) {
    return <p className="comment-list__empty">No comments yet.</p>;
  }

  return (
    <ul className="comment-list">
      {comments.map((c) => {
        const canModify = c.author.id === currentUserId;
        const isEditing = editingId === c.id;
        return (
          <li key={c.id} className="comment">
            <Avatar name={c.author.fullName} src={c.author.avatarUrl} size="sm" />
            <div className="comment__body">
              <header className="comment__head">
                <span className="comment__name">{c.author.fullName}</span>
                <span className="comment__time">
                  {formatTime(c.createdAt)}
                  {c.editedAt && <span className="comment__edited"> · edited</span>}
                </span>
                {canModify && !isEditing && (
                  <div className="comment__actions">
                    <button
                      type="button"
                      className="comment__icon-btn"
                      onClick={() => setEditingId(c.id)}
                      aria-label="Edit comment"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="comment__icon-btn"
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </header>
              {isEditing ? (
                <CommentInput
                  projectId={projectId}
                  initialValue={c.bodyMd}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={(body) => save(c.id, body)}
                  autoFocus
                />
              ) : (
                <p className="comment__text">{renderBody(c.bodyMd)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
