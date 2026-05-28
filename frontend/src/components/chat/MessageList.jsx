import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useToast } from '@/components/ui';
import { chatApi } from '@/api/chat.api';
import { useAuthStore } from '@/store/authStore';
import { useChannelRealtime } from '@/hooks/useChannelRealtime';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { Thread } from './Thread';
import './chat.css';

/**
 * Top-level chat surface for a single channel. Owns the message list,
 * the compose box, the active thread side panel, and the SignalR
 * subscription so the channel page just renders this and forgets.
 *
 * Optimistic posting: send → push a temp message with a `pending` id
 * → swap in the server payload (or revert on error). The SignalR push
 * for our own message is deduped by matching on id.
 */
export function MessageList({ channelId, channelArchived = false, orgSlug, onActivity }) {
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeThread, setActiveThread] = useState(null);

  const scrollerRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // Auto-scroll only when the user is already pinned to the bottom —
  // otherwise a new message would yank them out of context while
  // they're scrolling history.
  function isPinnedToBottom() {
    const el = scrollerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }
  function scrollToBottom(force = false) {
    const el = scrollerRef.current;
    if (!el) return;
    if (force || stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }

  const upsert = useCallback((dto) => {
    setMessages((cur) => {
      const idx = cur.findIndex((m) => m.id === dto.id);
      if (idx >= 0) {
        const next = cur.slice();
        next[idx] = dto;
        return next;
      }
      return [...cur, dto].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const remove = useCallback((id) => {
    setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, isDeleted: true, bodyMd: '' } : m)));
  }, []);

  useEffect(() => {
    if (!channelId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessages([]);
      setActiveThread(null);
      try {
        const page = await chatApi.listMessages(channelId, { limit: 50 });
        if (cancelled) return;
        setMessages(page.items);
        setHasMore(page.hasMore);
        setError(null);
        stickToBottomRef.current = true;
        // Defer to layout so the scroller has its content.
        requestAnimationFrame(() => scrollToBottom(true));
      } catch (err) {
        if (!cancelled) {
          setMessages([]);
          setError(err.response?.data?.detail ?? 'Could not load messages.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  async function loadOlder() {
    if (!channelId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = scrollerRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const before = messages[0].id;
      const page = await chatApi.listMessages(channelId, { before, limit: 50 });
      setMessages((cur) => {
        const known = new Set(cur.map((m) => m.id));
        const fresh = page.items.filter((m) => !known.has(m.id));
        return [...fresh, ...cur];
      });
      setHasMore(page.hasMore);
      // Preserve scroll position so the user's reading context doesn't
      // jump when older messages slot in above the viewport.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  }

  // SignalR push handlers.
  const handleEvent = useCallback((name, payload) => {
    if (name === 'chat.message_posted') {
      if (!payload) return;
      if (payload.parentMessageId) {
        // Bump the parent's reply count + lastReplyAt so the feed shows
        // the new thread activity without us having to refetch.
        setMessages((cur) => cur.map((m) => (
          m.id === payload.parentMessageId
            ? { ...m, replyCount: m.replyCount + 1, lastReplyAt: payload.createdAt }
            : m
        )));
      } else {
        const pinned = isPinnedToBottom();
        stickToBottomRef.current = pinned;
        upsert(payload);
        if (pinned) requestAnimationFrame(() => scrollToBottom());
      }
      onActivity?.();
    } else if (name === 'chat.message_edited') {
      if (payload?.parentMessageId == null) upsert(payload);
    } else if (name === 'chat.message_deleted') {
      remove(payload?.messageId);
    } else if (name === 'chat.reaction_toggled') {
      const dto = payload?.message;
      if (dto?.parentMessageId == null) upsert(dto);
    }
  }, [upsert, remove, onActivity]);

  useChannelRealtime(channelId, {
    'chat.message_posted': (p) => handleEvent('chat.message_posted', p),
    'chat.message_edited': (p) => handleEvent('chat.message_edited', p),
    'chat.message_deleted': (p) => handleEvent('chat.message_deleted', p),
    'chat.reaction_toggled': (p) => handleEvent('chat.reaction_toggled', p),
  });

  async function handlePost(bodyMd) {
    try {
      const dto = await chatApi.postMessage(channelId, { bodyMd });
      // Server push will also arrive — upsert dedupes by id.
      stickToBottomRef.current = true;
      upsert(dto);
      requestAnimationFrame(() => scrollToBottom(true));
      onActivity?.();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not send.' });
      throw err;
    }
  }

  async function handleEdit(messageId, bodyMd) {
    try {
      const dto = await chatApi.editMessage(messageId, { bodyMd });
      upsert(dto);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not edit.' });
    }
  }

  async function handleDelete(messageId) {
    if (!confirm('Delete this message? Others will see "(deleted)" in its place.')) return;
    try {
      await chatApi.deleteMessage(messageId);
      remove(messageId);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not delete.' });
    }
  }

  async function handleToggleReaction(messageId, emoji) {
    try {
      const res = await chatApi.toggleReaction(messageId, { emoji });
      upsert(res.message);
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not react.' });
    }
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="msg-pane">
      <div ref={scrollerRef} className="msg-scroll" onScroll={() => {
        stickToBottomRef.current = isPinnedToBottom();
      }}>
        {loading && <p className="muted msg-empty">Loading messages…</p>}
        {!loading && error && <p className="muted msg-empty">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <div className="msg-empty">
            <MessageSquare size={20} aria-hidden="true" color="var(--text-muted)" />
            <p className="muted">No messages yet — say hello.</p>
          </div>
        )}
        {!loading && hasMore && (
          <div className="msg-load-more">
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadOlder} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {grouped.map((group) => (
          <section key={group.dayLabel} className="msg-day-group">
            <div className="msg-day-divider">
              <span>{group.dayLabel}</span>
            </div>
            {group.items.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                currentUserId={currentUserId}
                orgSlug={orgSlug}
                onReply={(target) => setActiveThread(target)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleReaction={handleToggleReaction}
              />
            ))}
          </section>
        ))}
      </div>

      <div className="msg-compose">
        {channelArchived ? (
          <p className="muted msg-archived-note">
            This channel is archived. Unarchive it to keep posting.
          </p>
        ) : (
          <MessageInput
            placeholder="Send a message…"
            onSubmit={handlePost}
            disabled={channelArchived}
          />
        )}
      </div>

      {activeThread && (
        <Thread
          parentMessage={activeThread}
          channelId={channelId}
          orgSlug={orgSlug}
          onClose={() => setActiveThread(null)}
          onParentChanged={(dto) => upsert(dto)}
          onParentDeleted={(id) => remove(id)}
          onChildPosted={() => {
            setMessages((cur) => cur.map((m) => (
              m.id === activeThread.id
                ? { ...m, replyCount: m.replyCount + 1, lastReplyAt: new Date().toISOString() }
                : m
            )));
            onActivity?.();
          }}
        />
      )}
    </div>
  );
}

function groupByDay(items) {
  const groups = [];
  let currentLabel = null;
  for (const m of items) {
    const label = formatDayLabel(m.createdAt);
    if (label !== currentLabel) {
      groups.push({ dayLabel: label, items: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].items.push(m);
  }
  return groups;
}

function formatDayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
