import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui';
import { chatApi } from '@/api/chat.api';
import { useAuthStore } from '@/store/authStore';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';

/**
 * Side panel hosting a single thread: the parent message at the top,
 * every visible reply below, and a compose box pinned to the bottom.
 * Open via "Reply in thread" or the "N replies" footer in
 * <see cref="MessageList"/>.
 *
 * Closes on Escape or the X. Mutations bubble up so the parent feed
 * can keep its reply count + lastReplyAt synced without an extra
 * round-trip.
 */
export function Thread({
  parentMessage, channelId, orgSlug,
  onClose, onParentChanged, onParentDeleted, onChildPosted,
}) {
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [parent, setParent] = useState(parentMessage);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const thread = await chatApi.getThread(parentMessage.id);
      setParent(thread.parent);
      setReplies(thread.replies);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not load thread.');
    }
  }, [parentMessage.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function upsertReply(dto) {
    setReplies((cur) => {
      const idx = cur.findIndex((m) => m.id === dto.id);
      if (idx >= 0) {
        const next = cur.slice();
        next[idx] = dto;
        return next;
      }
      return [...cur, dto].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  async function handleReplyPost(bodyMd) {
    try {
      const dto = await chatApi.postMessage(channelId, {
        bodyMd, parentMessageId: parent.id,
      });
      upsertReply(dto);
      onChildPosted?.(dto);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not reply.' });
      throw err;
    }
  }

  async function handleEdit(messageId, bodyMd) {
    try {
      const dto = await chatApi.editMessage(messageId, { bodyMd });
      if (dto.id === parent.id) {
        setParent(dto);
        onParentChanged?.(dto);
      } else {
        upsertReply(dto);
      }
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not edit.' });
    }
  }

  async function handleDelete(messageId) {
    if (!confirm('Delete this message?')) return;
    try {
      await chatApi.deleteMessage(messageId);
      if (messageId === parent.id) {
        const stub = { ...parent, isDeleted: true, bodyMd: '' };
        setParent(stub);
        onParentDeleted?.(parent.id);
      } else {
        setReplies((cur) => cur.map((m) => (
          m.id === messageId ? { ...m, isDeleted: true, bodyMd: '' } : m
        )));
      }
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not delete.' });
    }
  }

  async function handleToggleReaction(messageId, emoji) {
    try {
      const res = await chatApi.toggleReaction(messageId, { emoji });
      if (res.message.id === parent.id) {
        setParent(res.message);
        onParentChanged?.(res.message);
      } else {
        upsertReply(res.message);
      }
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not react.' });
    }
  }

  return (
    <aside className="msg-thread" role="complementary" aria-label="Thread">
      <header className="msg-thread-head">
        <h2 className="msg-thread-title">Thread</h2>
        <button type="button" className="msg-thread-close" onClick={onClose} aria-label="Close thread">
          <X size={13} aria-hidden="true" />
        </button>
      </header>
      <div className="msg-thread-body">
        {loading && <p className="muted msg-empty">Loading thread…</p>}
        {!loading && error && <p className="muted msg-empty">{error}</p>}
        {!loading && !error && (
          <>
            <MessageItem
              message={parent}
              currentUserId={currentUserId}
              orgSlug={orgSlug}
              inThread
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleReaction={handleToggleReaction}
            />
            <div className="msg-thread-divider">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </div>
            {replies.map((r) => (
              <MessageItem
                key={r.id}
                message={r}
                currentUserId={currentUserId}
                orgSlug={orgSlug}
                inThread
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleReaction={handleToggleReaction}
              />
            ))}
          </>
        )}
      </div>
      <div className="msg-thread-compose">
        <MessageInput
          placeholder="Reply in thread…"
          onSubmit={handleReplyPost}
          autoFocus
        />
      </div>
    </aside>
  );
}
