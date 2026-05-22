import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Plus, RefreshCw } from 'lucide-react';
import { Badge, Button, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { supportApi } from '@/api/support.api';
import { TicketDetailDrawer } from '@/components/tickets/TicketDetailDrawer';
import { CreateTicketModal } from '@/components/tickets/CreateTicketModal';
import { useSlaTick } from '@/hooks/useSlaTick';
import './QueuePage.css';

const STATUS_TONE = {
  New: 'info',
  Open: 'info',
  Pending: 'warning',
  Reopened: 'warning',
  Resolved: 'success',
  Closed: 'neutral',
};

function slaTone(slaDueAt, now) {
  const ms = new Date(slaDueAt).getTime() - now;
  if (ms <= 0) return 'danger';
  if (ms < 30 * 60_000) return 'warning';
  return 'neutral';
}

function fmtCountdown(slaDueAt, now) {
  const ms = new Date(slaDueAt).getTime() - now;
  const breach = ms <= 0;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let body;
  if (days >= 1) body = `${days}d ${hrs % 24}h`;
  else if (hrs >= 1) body = `${hrs}h ${mins % 60}m`;
  else body = `${mins}m`;
  return breach ? `breached ${body}` : `due in ${body}`;
}

export function QueuePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const now = useSlaTick();

  const [project, setProject] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async (projectId) => {
    const data = await supportApi.getQueueView(projectId);
    setView(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load queues.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  if (error) {
    return (
      <div className="page">
        <p className="ai-wizard__error">{error}</p>
      </div>
    );
  }

  if (!project || !view) {
    return (
      <div className="page queue-page">
        <header className="page-header">
          <h1 className="page-title">Queues</h1>
        </header>
        <div className="vstack" style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={120} />)}
        </div>
      </div>
    );
  }

  const totalOpen = view.queues.reduce((s, q) => s + q.openCount, 0);
  const totalBreached = view.queues.reduce((s, q) => s + q.breachedCount, 0);

  return (
    <div className="page queue-page">
      <header className="page-header">
        <div className="hstack" style={{ gap: 12, alignItems: 'baseline' }}>
          <h1 className="page-title">Queues</h1>
          <span className="muted">
            · {totalOpen} open
            {totalBreached > 0 && (
              <span style={{ color: 'var(--status-danger)' }}> · {totalBreached} breached</span>
            )}
          </span>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => refresh(project.id).catch(() => {})}>
            <RefreshCw size={13} aria-hidden="true" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New ticket
          </Button>
        </div>
      </header>

      <div className="queue-page__sections">
        {view.queues.map((q) => (
          <section key={q.id} className="queue-section">
            <header className="queue-section__head">
              <div className="hstack" style={{ gap: 8 }}>
                <h2 className="queue-section__name">{q.name}</h2>
                <Badge tone={q.breachedCount > 0 ? 'danger' : 'neutral'}>
                  {q.openCount} open
                </Badge>
                {q.breachedCount > 0 && (
                  <Badge tone="danger">{q.breachedCount} breached</Badge>
                )}
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                <Clock size={11} aria-hidden="true" /> {Math.round(q.slaMinutes / 60)}h SLA
              </span>
            </header>

            {q.tickets.length === 0 ? (
              <div className="queue-section__empty">No open tickets.</div>
            ) : (
              <ul className="queue-section__list">
                {q.tickets.map((t) => (
                  <li
                    key={t.id}
                    className="ticket-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenTicketId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenTicketId(t.id);
                      }
                    }}
                  >
                    <Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>{t.status}</Badge>
                    <div className="grow">
                      <div className="ticket-row__subject truncate">{t.subject}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {t.customerName}
                        {t.customerTier ? ` · ${t.customerTier}` : ''} · {t.replyCount} replies
                      </div>
                    </div>
                    <Badge tone={slaTone(t.slaDueAt, now)}>
                      {fmtCountdown(t.slaDueAt, now)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {creating && project && (
        <CreateTicketModal
          projectId={project.id}
          queues={view.queues.map((q) => ({ id: q.id, name: q.name }))}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh(project.id).catch(() => {});
            toast.show({ tone: 'success', message: 'Ticket created.' });
          }}
        />
      )}

      {openTicketId && (
        <TicketDetailDrawer
          ticketId={openTicketId}
          onClose={() => setOpenTicketId(null)}
          onChanged={() => refresh(project.id).catch(() => {})}
        />
      )}
    </div>
  );
}
