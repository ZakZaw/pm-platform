import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Archive, AtSign, Hash, Link2, MoreHorizontal } from 'lucide-react';
import { Avatar, Dropdown, useToast } from '@/components/ui';
import { chatApi } from '@/api/chat.api';
import { MessageList } from '@/components/chat/MessageList';

const TYPE_LABELS = {
  OrgWide: 'Organisation channel',
  Project: 'Project channel',
  Team: 'Team channel',
  Topic: 'Topic channel',
  Dm: 'Direct message',
};

const TYPE_ICONS = {
  OrgWide: Hash,
  Project: Hash,
  Team: Hash,
  Topic: Hash,
  Dm: AtSign,
};

/**
 * Channel detail surface. Header + live message thread (F2-18) + member
 * panel. Marks the channel as read on mount; subsequent posts bubble
 * a fresh sidebar refresh through the outlet so the parent layout
 * re-reads its unread badges.
 */
export function ChannelPage() {
  const { slug: orgSlug, channelId } = useParams();
  const ctx = useOutletContext() ?? {};
  const toast = useToast();

  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [archiving, setArchiving] = useState(false);

  // Reload helper for actions that mutate the channel (archive, leave).
  const reload = useCallback(async () => {
    if (!channelId) return;
    try {
      const data = await chatApi.getChannel(channelId);
      setChannel(data);
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not load channel.');
    }
  }, [channelId]);

  useEffect(() => {
    let cancelled = false;
    if (!channelId) return undefined;
    (async () => {
      setLoading(true);
      try {
        const data = await chatApi.getChannel(channelId);
        if (cancelled) return;
        setChannel(data);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail ?? 'Could not load channel.');
          setChannel(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [channelId]);

  // Stamp the read marker once per mount per channel.
  const refreshSidebar = ctx.refresh;
  useEffect(() => {
    if (!channelId) return;
    chatApi.markRead(channelId).then(() => refreshSidebar?.()).catch(() => {});
  }, [channelId, refreshSidebar]);

  async function onArchive() {
    if (!channel || channel.type !== 'Topic') return;
    if (!confirm(`Archive #${channel.name}? You can recreate it later.`)) return;
    setArchiving(true);
    try {
      await chatApi.archive(channel.id);
      toast.show({ tone: 'success', message: 'Channel archived.' });
      await refreshSidebar?.();
      await reload();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not archive.',
      });
    } finally {
      setArchiving(false);
    }
  }

  if (loading) {
    return <div className="chat-pane chat-pane-empty"><p className="muted">Loading channel…</p></div>;
  }
  if (error) {
    return <div className="chat-pane chat-pane-empty"><p className="muted">{error}</p></div>;
  }
  if (!channel) {
    return (
      <div className="chat-pane chat-pane-empty">
        <span className="chat-pane-empty-icon"><Hash size={20} aria-hidden="true" /></span>
        <p className="muted">Select a channel to start.</p>
      </div>
    );
  }

  const HeaderIcon = TYPE_ICONS[channel.type] ?? Hash;
  const canArchive = channel.type === 'Topic' && !channel.archivedAt;
  const memberCount = channel.members.length;

  return (
    <div className="chat-pane">
      <header className="chat-pane-head">
        <div className="chat-pane-ident">
          <span className="chat-pane-icon"><HeaderIcon size={18} aria-hidden="true" /></span>
          <div className="truncate">
            <h1 className="chat-pane-title truncate">{channel.name}</h1>
            <p className="chat-pane-sub">
              <span className="chat-pane-sub-item">{TYPE_LABELS[channel.type] ?? channel.type}</span>
              <span className="chat-pane-sub-item">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
              {channel.epicId && channel.epicTitle && (
                <span className="chat-pane-sub-item chat-pane-sub-epic">
                  <Link2 size={12} aria-hidden="true" /> Linked epic · {channel.epicTitle}
                </span>
              )}
              {channel.archivedAt && (
                <span className="chat-pane-sub-item">
                  <Archive size={12} aria-hidden="true" /> Archived
                </span>
              )}
            </p>
          </div>
        </div>
        {canArchive && (
          <Dropdown
            align="end"
            trigger={(
              <button
                type="button"
                className="icon-btn"
                aria-label="Channel actions"
                title="Channel actions"
                disabled={archiving}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
            )}
          >
            <Dropdown.Item
              onSelect={onArchive}
              disabled={archiving}
              icon={<Archive size={13} aria-hidden="true" />}
            >
              {archiving ? 'Archiving…' : 'Archive channel'}
            </Dropdown.Item>
          </Dropdown>
        )}
      </header>

      <div className="chat-pane-body">
        <MessageList
          channelId={channel.id}
          channelArchived={!!channel.archivedAt}
          orgSlug={orgSlug}
          onActivity={() => {
            // Posting / receiving a message changes the sidebar unread
            // badge — refresh the channel list (debounced upstream).
            refreshSidebar?.();
          }}
        />
      </div>

      <aside className="chat-pane-members" aria-label="Channel members">
        <div className="chat-pane-members-head">
          Members <span className="chat-pane-members-count">{memberCount}</span>
        </div>
        <ul className="chat-members-list">
          {channel.members.map((m) => (
            <li key={m.userId} className="chat-member-row">
              <Avatar src={m.avatarUrl} name={m.fullName || m.email} size="md" />
              <div className="chat-member-meta">
                <div className="chat-member-name truncate">{m.fullName}</div>
                <div className="chat-member-mail truncate">{m.email}</div>
              </div>
            </li>
          ))}
          {memberCount === 0 && (
            <li className="chat-members-empty">No members yet.</li>
          )}
        </ul>
      </aside>
    </div>
  );
}
