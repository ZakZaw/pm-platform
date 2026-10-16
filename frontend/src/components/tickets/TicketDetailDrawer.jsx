import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Lock, X } from 'lucide-react';
import { Button, Select, useToast } from '@/components/ui';
import { supportApi } from '@/api/support.api';
import { useSlaTick } from '@/hooks/useSlaTick';
import { TICKET_STATUS_CLASS } from './ticketStatus';
import './TicketDetailDrawer.css';

const STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Open', label: 'Open' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Reopened', label: 'Reopened' },
];

function slaLabel(ticket, now) {
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return ticket.resolvedAt
      ? `Resolved ${new Date(ticket.resolvedAt).toLocaleString()}`
      : 'Closed';
  }
  const ms = new Date(ticket.slaDueAt).getTime() - now;
  const breach = ms <= 0;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  const hrs = Math.floor(mins / 60);
  let body;
  if (hrs >= 24) body = `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  else if (hrs >= 1) body = `${hrs}h ${mins % 60}m`;
  else body = `${mins}m`;
  return breach ? `SLA breached ${body} ago` : `SLA due in ${body}`;
}

export function TicketDetailDrawer({ ticketId, onClose, onChanged }) {
  const toast = useToast();
  const now = useSlaTick();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  async function load() {
    const d = await supportApi.getTicket(ticketId);
    setData(d);
  }

  // Clear the previous ticket during render when switching to another one.
  const [loadedFor, setLoadedFor] = useState(ticketId);
  if (ticketId !== loadedFor) {
    setLoadedFor(ticketId);
    if (ticketId) {
      setData(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    supportApi.getTicket(ticketId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load ticket.');
      });
    return () => { cancelled = true; };
  }, [ticketId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function changeStatus(to) {
    if (!data?.ticket || to === data.ticket.status) return;
    setSaving(true);
    try {
      const updated = await supportApi.changeStatus(data.ticket.id, to);
      setData({ ...data, ticket: updated });
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not change status',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    try {
      await supportApi.addReply(data.ticket.id, { bodyMd: text, isInternal });
      setBody('');
      await load();
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not send reply',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    }
  }

  return createPortal(
    <div className="ticket-drawer-backdrop" onClick={onClose}>
      <aside
        className="ticket-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ticket-drawer-head">
          <div className="ticket-drawer-head-meta">
            <span className={`status ${TICKET_STATUS_CLASS[data?.ticket.status] ?? 'status-todo'}`}>
              {data?.ticket.status ?? '…'}
            </span>
            <span className="muted">
              {data?.ticket.customerName}
              {data?.ticket.customerTier ? ` · ${data.ticket.customerTier}` : ''}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        {error && <p className="ticket-drawer-error">{error}</p>}
        {!data && !error && <p className="ticket-drawer-placeholder">Loading…</p>}

        {data && (
          <div className="ticket-drawer-body">
            <h2 className="ticket-drawer-title">{data.ticket.subject}</h2>

            <div className="ticket-drawer-meta">
              <span
                className={[
                  'ticket-drawer-sla',
                  data.ticket.isBreached ? 'is-danger'
                    : data.ticket.status === 'Resolved' || data.ticket.status === 'Closed' ? 'is-ok'
                      : '',
                ].filter(Boolean).join(' ')}
              >
                {slaLabel(data.ticket, now)}
              </span>
              <span className="grow" />
              <Select
                aria-label="Ticket status"
                value={data.ticket.status}
                onChange={(e) => changeStatus(e.target.value)}
                disabled={saving}
                options={STATUS_OPTIONS}
              />
            </div>

            {data.ticket.bodyMd && (
              <div className="ticket-drawer-body-md">{data.ticket.bodyMd}</div>
            )}

            <section className="ticket-drawer-section">
              <h3 className="ticket-drawer-section-title">Replies</h3>
              <ul className="ticket-drawer-replies">
                {data.replies.length === 0 && (
                  <li className="ticket-drawer-empty">No replies yet.</li>
                )}
                {data.replies.map((r) => (
                  <li
                    key={r.id}
                    className={[
                      'ticket-drawer-reply',
                      r.isInternal ? 'is-internal' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="ticket-drawer-reply-head">
                      {r.isInternal ? (
                        <span className="ticket-drawer-reply-kind is-internal">
                          <Lock size={12} aria-hidden="true" /> Internal note
                        </span>
                      ) : (
                        <span className="ticket-drawer-reply-kind">
                          <Eye size={12} aria-hidden="true" /> Public reply
                        </span>
                      )}
                      <span className="grow" />
                      <span className="ticket-drawer-reply-time">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="ticket-drawer-reply-body">{r.bodyMd}</div>
                  </li>
                ))}
              </ul>

              <form className="ticket-drawer-reply-form" onSubmit={submitReply}>
                <textarea
                  className="textarea"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={isInternal ? 'Note visible only to your team…' : 'Reply to the customer…'}
                />
                <div className="ticket-drawer-reply-actions">
                  <label className="ticket-drawer-internal-toggle">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    {isInternal ? (
                      <>
                        <EyeOff size={12} aria-hidden="true" />
                        Internal note
                      </>
                    ) : (
                      <>
                        <Eye size={12} aria-hidden="true" />
                        Public reply
                      </>
                    )}
                  </label>
                  <span className="grow" />
                  <Button type="submit" size="sm" disabled={!body.trim()}>
                    Send
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
