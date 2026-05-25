import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { Avatar, Icon } from '@/components/ui';
import { notificationsApi } from '@/api/notifications.api';
import { useUserRealtime } from '@/hooks/useUserRealtime';
import './NotificationsPanel.css';

const KIND_ICON = {
  Mention: 'at-sign',
  TaskAssigned: 'user-plus',
  TaskStatusChanged: 'arrow-right',
  TaskDue: 'clock',
  EpicDatesChanged: 'calendar',
  MilestoneAdded: 'rocket',
  SprintStarted: 'zap',
  SprintClosed: 'check',
  ProjectInvite: 'users',
  AiSuggestion: 'sparkles',
  System: 'info',
};

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);

  const reload = useCallback(async () => {
    try {
      const r = await notificationsApi.listMine({ limit: 25 });
      setItems(r.items ?? []);
      setUnread(r.unreadTotal ?? 0);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Fetch the unread count once on mount so the badge is accurate before
  // the user opens the panel.
  useEffect(() => { reload(); }, [reload]);

  // Re-fetch when the panel opens — gives us fresh items without waiting
  // for a realtime push.
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  // Click outside to close.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Realtime: any notification.arrived push bumps the inbox.
  const handlers = useMemo(() => ({
    'notification.arrived': () => reload(),
  }), [reload]);
  useUserRealtime(handlers);

  const handleItemClick = async (item) => {
    if (!item.readAt) {
      // Optimistic update — the panel feels snappy even if the API is slow.
      setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(item.id).catch(() => reload());
    }
    if (item.linkUrl) {
      setOpen(false);
      navigate(item.linkUrl);
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => n.readAt ? n : { ...n, readAt: new Date().toISOString() }));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      reload();
    }
  };

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-ghost btn-icon-sm notif-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ''}`}
        title="Notifications"
      >
        <Bell size={14} aria-hidden="true" />
        {unread > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <header className="notif-panel__head">
            <strong>Notifications</strong>
            <button
              type="button"
              className="notif-mark-all"
              onClick={handleMarkAll}
              disabled={unread === 0}
              title="Mark all as read"
            >
              <CheckCheck size={12} aria-hidden="true" />
              <span>Mark all read</span>
            </button>
          </header>
          <div className="notif-panel__body">
            {!loaded && <div className="notif-empty">Loading…</div>}
            {loaded && items.length === 0 && (
              <div className="notif-empty">You're all caught up.</div>
            )}
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onClick }) {
  const iconName = KIND_ICON[item.kind] ?? 'bell';
  return (
    <button
      type="button"
      className={`notif-row ${item.readAt ? 'is-read' : ''}`}
      onClick={onClick}
    >
      <div className="notif-row__icon">
        {item.actorName ? (
          <Avatar name={item.actorName} src={item.actorAvatarUrl} size="xs" />
        ) : (
          <span className="notif-row__kind">
            <Icon name={iconName} size={12} />
          </span>
        )}
      </div>
      <div className="notif-row__main">
        <div className="notif-row__title">
          {!item.readAt && <span className="notif-row__dot" aria-hidden="true" />}
          {item.title}
        </div>
        {item.bodyMd && (
          <div className="notif-row__body">{item.bodyMd}</div>
        )}
        <div className="notif-row__meta">
          {item.projectName && <span>{item.projectName}</span>}
          {item.projectName && <span aria-hidden="true">·</span>}
          <span title={new Date(item.createdAt).toLocaleString()}>
            {relativeTime(item.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
