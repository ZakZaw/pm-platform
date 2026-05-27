import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  Bookmark,
  Building2,
  FolderKanban,
  Hash,
  Plus,
  Users,
} from 'lucide-react';
import { Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, useToast } from '@/components/ui';
import { chatApi } from '@/api/chat.api';
import './ChannelsLayout.css';

const TYPE_ICONS = {
  OrgWide: Building2,
  Project: FolderKanban,
  Team: Users,
  Topic: Hash,
};

const TYPE_ORDER = ['OrgWide', 'Project', 'Team', 'Topic'];

const TYPE_LABELS = {
  OrgWide: 'Organisation',
  Project: 'Projects',
  Team: 'Teams',
  Topic: 'Topics',
};

/**
 * F2-16 — chat layout. Sidebar lists every channel the current user can
 * read in the active org, grouped by type. Content area renders the
 * selected channel via Outlet. Message posting lands in F2-18; until
 * then the channel page is a placeholder with members + linked-epic
 * badge.
 */
export function ChannelsLayout() {
  const { slug: orgSlug, channelId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Child pages (ChannelPage) call this through outlet context to
  // refresh the sidebar after a mark-read / archive / leave action.
  const refresh = useCallback(async () => {
    try {
      const list = await chatApi.listChannels(orgSlug);
      setChannels(list);
    } catch {
      // Toast surfaces the error on the actor's screen; the sidebar
      // just keeps its previous snapshot.
    }
  }, [orgSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await chatApi.listChannels(orgSlug);
        if (cancelled) return;
        setChannels(list);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail ?? 'Could not load channels.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug]);

  // If the URL has no channelId, redirect to the first one we found
  // (org-wide preferred). Keeps the layout coherent on hard-load.
  useEffect(() => {
    if (channelId || channels.length === 0) return;
    const first = channels.find((c) => c.type === 'OrgWide') ?? channels[0];
    if (first) navigate(`/${orgSlug}/chat/${first.id}`, { replace: true });
  }, [channelId, channels, navigate, orgSlug]);

  const grouped = useMemo(() => {
    const buckets = Object.fromEntries(TYPE_ORDER.map((t) => [t, []]));
    for (const c of channels) {
      if (!buckets[c.type]) buckets[c.type] = [];
      buckets[c.type].push(c);
    }
    return buckets;
  }, [channels]);

  async function handleCreated(newChannel) {
    setCreateOpen(false);
    await refresh();
    navigate(`/${orgSlug}/chat/${newChannel.id}`);
    toast.show({ tone: 'success', message: `Created #${newChannel.name}.` });
  }

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar" aria-label="Channels">
        <header className="chat-sidebar-head">
          <div className="chat-sidebar-title">Channels</div>
          <button
            type="button"
            className="btn btn-ghost btn-icon-sm"
            onClick={() => setCreateOpen(true)}
            title="New topic channel"
            aria-label="New topic channel"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </header>

        {loading && <p className="muted chat-sidebar-empty">Loading…</p>}
        {error && <p className="chat-sidebar-empty" style={{ color: 'var(--danger)' }}>{error}</p>}

        {!loading && !error && (
          <div className="chat-sidebar-scroll">
            {TYPE_ORDER.map((type) => {
              const items = grouped[type] ?? [];
              if (items.length === 0) return null;
              const Icon = TYPE_ICONS[type] ?? Hash;
              return (
                <section key={type} className="chat-sidebar-section">
                  <div className="chat-sidebar-label">{TYPE_LABELS[type] ?? type}</div>
                  {items.map((c) => {
                    const active = c.id === channelId;
                    return (
                      <Link
                        key={c.id}
                        to={`/${orgSlug}/chat/${c.id}`}
                        className={['chat-sidebar-item', active ? 'is-active' : ''].filter(Boolean).join(' ')}
                        title={c.name}
                      >
                        <Icon size={13} aria-hidden="true" />
                        <span className="chat-sidebar-item-name truncate">
                          {c.name}
                        </span>
                        {c.archivedAt && (
                          <Archive size={11} aria-hidden="true" color="var(--text-muted)" />
                        )}
                        {!c.archivedAt && c.unreadCount > 0 && (
                          <span className="chat-sidebar-unread" aria-label="Unread" />
                        )}
                      </Link>
                    );
                  })}
                </section>
              );
            })}
            {channels.length === 0 && (
              <p className="muted chat-sidebar-empty">
                No channels yet. Create a topic to get started.
              </p>
            )}
          </div>
        )}
      </aside>

      <section className="chat-content">
        <Outlet context={{ orgSlug, refresh, channels }} />
      </section>

      <CreateTopicModal
        open={createOpen}
        orgSlug={orgSlug}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function CreateTopicModal({ open, orgSlug, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  function closeAndReset() {
    setName('');
    onClose?.();
  }

  async function submit(e) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const created = await chatApi.createTopicChannel(orgSlug, { name: name.trim() });
      setName('');
      onCreated?.(created);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create channel.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={closeAndReset} labelledBy="chat-create-title" size="md">
      <ModalHeader>
        <Bookmark size={14} aria-hidden="true" />
        <h2 id="chat-create-title" className="modal-title">New topic channel</h2>
      </ModalHeader>
      <form onSubmit={submit}>
        <ModalBody>
          <Input
            label="Name"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. launch-week"
            minLength={2}
            maxLength={120}
            required
          />
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s-3)' }}>
            Project and team channels are auto-created — pick Topic when you want a
            cross-cutting space. Topic channels archive automatically after 30 days
            of silence.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={closeAndReset} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="ai" disabled={busy || name.trim().length < 2}>
            {busy ? 'Creating…' : 'Create channel'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

