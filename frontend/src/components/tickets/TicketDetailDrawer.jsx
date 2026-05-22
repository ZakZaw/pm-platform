import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Lock, X } from 'lucide-react';
import { Badge, Button, Select, useToast } from '@/components/ui';
import { supportApi } from '@/api/support.api';
import { useSlaTick } from '@/hooks/useSlaTick';
import './TicketDetailDrawer.css';

const STATUS_OPTIONS = [
  { value: 'New', label: 'New' },
  { value: 'Open', label: 'Open' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Reopened', label: 'Reopened' },
];

const STATUS_TONE = {
  New: 'info',
  Open: 'info',
  Pending: 'warning',
  Reopened: 'warning',
  Resolved: 'success',
  Closed: 'neutral',
};

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

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    setData(null);
    setError(null);
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
    <div className="ticket-drawer__backdrop" onClick={onClose}>
      <aside
        className="ticket-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ticket-drawer__head">
          <div className="hstack" style={{ gap: 8 }}>
            <Badge tone={STATUS_TONE[data?.ticket.status] ?? 'neutral'}>
              {data?.ticket.status ?? '…'}
            </Badge>
            <span className="muted" style={{ fontSize: 12 }}>
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

        {error && <p className="ticket-drawer__error">{error}</p>}
        {!data && !error && <p className="ticket-drawer__placeholder">Loading…</p>}

        {data && (
          <div className="ticket-drawer__body">
            <h2 className="ticket-drawer__title">{data.ticket.subject}</h2>

            <div className="hstack ticket-drawer__meta">
              <Badge
                tone={
                  data.ticket.isBreached ? 'danger'
                  : data.ticket.status === 'Resolved' || data.ticket.status === 'Closed' ? 'success'
                  : 'neutral'
                }
              >
                {slaLabel(data.ticket, now)}
              </Badge>
              <span className="grow" />
              <Select
                value={data.ticket.status}
                onChange={(e) => changeStatus(e.target.value)}
                disabled={saving}
                options={STATUS_OPTIONS}
              />
            </div>

            {data.ticket.bodyMd && (
              <div className="ticket-drawer__body-md">{data.ticket.bodyMd}</div>
            )}

            <div className="subsection">
              <div className="subsection-eyebrow">Replies</div>
              <ul className="ticket-drawer__replies">
                {data.replies.length === 0 && (
                  <li className="muted" style={{ padding: 12 }}>No replies yet.</li>
                )}
                {data.replies.map((r) => (
                  <li
                    key={r.id}
                    className={[
                      'ticket-drawer__reply',
                      r.isInternal ? 'is-internal' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="hstack ticket-drawer__reply-head">
                      {r.isInternal ? (
                        <Badge tone="warning">
                          <Lock size={11} aria-hidden="true" /> Internal note
                        </Badge>
                      ) : (
                        <Badge tone="info">
                          <Eye size={11} aria-hidden="true" /> Public reply
                        </Badge>
                      )}
                      <span className="grow" />
                      <span className="muted" style={{ fontSize: 11 }}>
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="ticket-drawer__reply-body">{r.bodyMd}</div>
                  </li>
                ))}
              </ul>

              <form className="ticket-drawer__reply-form" onSubmit={submitReply}>
                <textarea
                  className="input"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={isInternal ? 'Note visible only to your team…' : 'Reply to the customer…'}
                />
                <div className="hstack" style={{ marginTop: 8 }}>
                  <label className="hstack" style={{ gap: 6, cursor: 'pointer', fontSize: 12 }}>
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
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
