import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  AtSign,
  Bookmark,
  Building2,
  FolderKanban,
  Hash,
  MessageSquarePlus,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { Avatar, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, useToast } from '@/components/ui';
import { chatApi } from '@/api/chat.api';
import { orgsApi } from '@/api/orgs.api';
import { useAuthStore } from '@/store/authStore';
import './ChannelsLayout.css';

const TYPE_ICONS = {
  OrgWide: Building2,
  Project: FolderKanban,
  Team: Users,
  Topic: Hash,
  Dm: AtSign,
};

const TYPE_ORDER = ['OrgWide', 'Project', 'Team', 'Topic', 'Dm'];

const TYPE_LABELS = {
  OrgWide: 'Organisation',
  Project: 'Projects',
  Team: 'Teams',
  Topic: 'Topics',
  Dm: 'Direct messages',
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
  const [dmOpen, setDmOpen] = useState(false);

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

  async function handleDmCreated(newDm) {
    setDmOpen(false);
    await refresh();
    navigate(`/${orgSlug}/chat/${newDm.id}`);
  }

  return (
    <div className="chat-layout">
      <aside className="chat-sidebar" aria-label="Channels">
        <header className="chat-sidebar-head">
          <div className="chat-sidebar-title">Channels</div>
          <div className="row gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-icon-sm"
              onClick={() => setDmOpen(true)}
              title="New direct message"
              aria-label="New direct message"
            >
              <MessageSquarePlus size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon-sm"
              onClick={() => setCreateOpen(true)}
              title="New topic channel"
              aria-label="New topic channel"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
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

      <NewDmModal
        open={dmOpen}
        orgSlug={orgSlug}
        onClose={() => setDmOpen(false)}
        onCreated={handleDmCreated}
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


// F2-17 — picker for direct-message conversation. Multi-select up to
// seven others (the caller fills the 8th slot). 1:1 DM dedup happens
// server-side: if a DM with the same member set already exists, the
// command returns it instead of creating a duplicate.
const MAX_OTHER_MEMBERS = 7;

function NewDmModal({ open, orgSlug, onClose, onCreated }) {
  const toast = useToast();
  const me = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]); // [{ userId, fullName, email, avatarUrl }]
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  function closeAndReset() {
    setSearch('');
    setResults([]);
    setPicked([]);
    onClose?.();
  }

  // Debounced search against /orgs/{slug}/members. Min 1 char so the
  // typeahead doesn't yank everyone in big orgs. We drive results
  // exclusively from the async response so the linter is happy about
  // setState-in-effect rules.
  useEffect(() => {
    if (!open) return undefined;
    const trimmed = search.trim();
    let cancelled = false;
    const handle = setTimeout(async () => {
      if (trimmed.length === 0) {
        if (!cancelled) setResults([]);
        return;
      }
      setSearching(true);
      try {
        const page = await orgsApi.listMembers(orgSlug, { search: trimmed, pageSize: 10 });
        if (cancelled) return;
        const pickedIds = new Set(picked.map((p) => p.userId));
        const filtered = (page.items ?? page).filter((m) =>
          m.userId !== me?.id && !pickedIds.has(m.userId));
        setResults(filtered);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, orgSlug, search, picked, me?.id]);

  function pick(member) {
    if (picked.length >= MAX_OTHER_MEMBERS) return;
    setPicked((cur) => [...cur, member]);
    setSearch('');
    setResults([]);
  }

  function unpick(userId) {
    setPicked((cur) => cur.filter((p) => p.userId !== userId));
  }

  async function submit(e) {
    e.preventDefault();
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const dm = await chatApi.createDm(orgSlug, {
        memberIds: picked.map((p) => p.userId),
      });
      const wasReused = new Date(dm.createdAt).getTime() < Date.now() - 5_000;
      toast.show({
        tone: 'success',
        message: wasReused ? 'Opened existing DM.' : 'DM created.',
      });
      // Reset before bubbling up so the parent's navigate happens with
      // a clean modal state ready for the next open.
      setSearch('');
      setResults([]);
      setPicked([]);
      onCreated?.(dm);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not start DM.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={closeAndReset} labelledBy="chat-dm-title" size="md">
      <ModalHeader>
        <AtSign size={14} aria-hidden="true" />
        <h2 id="chat-dm-title" className="modal-title">New direct message</h2>
      </ModalHeader>
      <form onSubmit={submit}>
        <ModalBody>
          {picked.length > 0 && (
            <div className="dm-chip-row">
              {picked.map((p) => (
                <span key={p.userId} className="dm-chip">
                  <Avatar src={p.avatarUrl} name={p.fullName || p.email} size="xs" />
                  <span className="truncate">{p.fullName || p.email}</span>
                  <button
                    type="button"
                    className="dm-chip-x"
                    onClick={() => unpick(p.userId)}
                    aria-label={`Remove ${p.fullName}`}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            label="Add member"
            data-autofocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={picked.length >= MAX_OTHER_MEMBERS
              ? `Maximum ${MAX_OTHER_MEMBERS} other members reached`
              : 'Search by name or email'}
            disabled={picked.length >= MAX_OTHER_MEMBERS}
          />
          {results.length > 0 && (
            <ul className="dm-result-list">
              {results.map((m) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    className="dm-result-row"
                    onClick={() => pick(m)}
                  >
                    <Avatar src={m.avatarUrl} name={m.fullName || m.email} size="sm" />
                    <div className="col" style={{ gap: 1, minWidth: 0, flex: 1 }}>
                      <div className="dm-result-name truncate">{m.fullName}</div>
                      <div className="dm-result-mail truncate">{m.email}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && search.trim().length > 0 && results.length === 0 && (
            <p className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s-3)' }}>
              No matching members.
            </p>
          )}
          <p className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s-3)' }}>
            Direct messages can include up to 8 people. Picking the same set
            twice opens the existing conversation.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={closeAndReset} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="ai" disabled={busy || picked.length === 0}>
            {busy ? 'Opening…' : picked.length > 1 ? 'Open group DM' : 'Open DM'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
