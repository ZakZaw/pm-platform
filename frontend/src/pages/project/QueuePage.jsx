import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { Avatar, Button, Skeleton, StatusBadge, Priority, useToast } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { projectsApi } from '@/api/projects.api';
import { supportApi } from '@/api/support.api';
import { TicketDetailDrawer } from '@/components/tickets/TicketDetailDrawer';
import { CreateTicketModal } from '@/components/tickets/CreateTicketModal';
import { useSlaTick } from '@/hooks/useSlaTick';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './QueuePage.css';

function slaState(slaDueAt, now) {
  const ms = new Date(slaDueAt).getTime() - now;
  if (ms <= 0) return 'danger';
  if (ms < 30 * 60_000) return 'warn';
  return 'ok';
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
  return breach ? `-${body}` : body;
}

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Open', label: 'Open' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Breaching', label: 'SLA breaching' },
  { id: 'Mine', label: 'Assigned to me' },
];

export function QueuePage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const now = useSlaTick();
  const userId = useAuthStore((s) => s.user?.id);
  const { members } = useOrgMembers(orgSlug);

  const [project, setProject] = useState(null);
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [openTicketId, setOpenTicketId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('All');

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

  const allTickets = useMemo(() => {
    if (!view) return [];
    return view.queues.flatMap((q) =>
      q.tickets.map((t) => ({ ...t, queueId: q.id, queueName: q.name })),
    );
  }, [view]);

  const counts = useMemo(() => ({
    All: allTickets.length,
    Open: allTickets.filter((t) => t.status === 'Open' || t.status === 'New').length,
    Pending: allTickets.filter((t) => t.status === 'Pending').length,
    Breaching: allTickets.filter((t) => slaState(t.slaDueAt, now) === 'danger').length,
    Mine: allTickets.filter((t) => t.assigneeId === userId).length,
  }), [allTickets, now, userId]);

  const shown = useMemo(() => {
    if (tab === 'All') return allTickets;
    if (tab === 'Breaching') return allTickets.filter((t) => slaState(t.slaDueAt, now) === 'danger');
    if (tab === 'Mine') return allTickets.filter((t) => t.assigneeId === userId);
    if (tab === 'Open') return allTickets.filter((t) => t.status === 'Open' || t.status === 'New');
    return allTickets.filter((t) => t.status === tab);
  }, [allTickets, tab, now, userId]);

  if (error) {
    return <div className="main-inner"><p className="muted">{error}</p></div>;
  }

  if (!project || !view) {
    return (
      <div className="main-inner queue-page">
        <div className="page-head">
          <h1 className="page-title">Queue</h1>
        </div>
        <div className="col gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} height={48} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="main-inner queue-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Support · Queue</div>
            <h1 className="page-title">{project.name}</h1>
            <div className="page-subtitle">
              {counts.All} ticket{counts.All === 1 ? '' : 's'} · {counts.Breaching} breaching SLA
            </div>
          </div>
          <div className="row gap-3">
            <Button variant="ghost" size="sm" onClick={() => refresh(project.id).catch(() => {})}>
              <RefreshCw size={13} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus size={13} aria-hidden="true" /> New ticket
            </Button>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {counts[t.id] != null && <span className="tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'var(--s-6)' }}>
        <div className="queue">
          <div className="queue-row queue-head">
            <div>ID</div>
            <div>Subject</div>
            <div>Customer</div>
            <div>Priority</div>
            <div>Status</div>
            <div>SLA</div>
            <div>Assignee</div>
          </div>
          {shown.length === 0 && (
            <div className="queue-empty">No tickets.</div>
          )}
          {shown.map((t) => {
            const sla = slaState(t.slaDueAt, now);
            const assignee = t.assigneeId
              ? members.find((m) => m.userId === t.assigneeId)
              : null;
            return (
              <div
                key={t.id}
                className={['queue-row', sla === 'danger' ? 'is-urgent' : ''].filter(Boolean).join(' ')}
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
                <div className="queue-id">{t.key ?? t.id?.slice(0, 6)}</div>
                <div>
                  <div className="queue-subj truncate">{t.subject}</div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>
                    {t.queueName}
                    {t.customerTier ? ` · ${t.customerTier}` : ''}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{t.customerName}</div>
                <div><Priority level={t.priority} /></div>
                <div><StatusBadge status={t.status} /></div>
                <div>
                  <span className={`sla is-${sla}`}>
                    <span className="sla-dot" />
                    {fmtCountdown(t.slaDueAt, now)}
                  </span>
                </div>
                <div>
                  {assignee ? (
                    <Avatar src={assignee.avatarUrl} name={assignee.fullName} size="sm" />
                  ) : (
                    <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
