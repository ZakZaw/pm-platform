import { useEffect, useState } from 'react';
import { supportApi } from '@/api/support.api';
import { DashboardWidget, MetricRow, StackedBar } from '../DashboardWidget';

const QUEUE_COLORS = ['#5B6AF0', '#4FD1E0', '#E5484D', '#E0A23A', '#3FB984', '#7A6BFF'];

function useQueueView(projectId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    supportApi.getQueueView(projectId)
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  return { data, loading };
}

export function SupportOpenTicketsWidget({ project }) {
  const { data, loading } = useQueueView(project.id);
  const queues = data?.queues ?? [];
  const open = queues.reduce((s, q) => s + q.openCount, 0);
  const breached = queues.reduce((s, q) => s + q.breachedCount, 0);
  return (
    <DashboardWidget
      title="Open tickets"
      eyebrow="Support"
      loading={loading}
      empty={!loading && open === 0}
      emptyText="Inbox zero."
    >
      <MetricRow
        label="Currently open"
        value={open}
        sublabel={breached > 0 ? `${breached} past SLA` : 'All within SLA'}
        accent={breached > 0 ? 'var(--status-danger)' : undefined}
      />
    </DashboardWidget>
  );
}

export function SupportSlaBreachWidget({ project }) {
  const { data, loading } = useQueueView(project.id);
  const queues = data?.queues ?? [];
  const flat = queues.flatMap((q) =>
    (q.tickets ?? []).filter((t) => t.isBreached).map((t) => ({ ...t, queueName: q.name })));
  return (
    <DashboardWidget
      title="SLA breaches"
      eyebrow="Support"
      loading={loading}
      empty={!loading && flat.length === 0}
      emptyText="No SLA breaches right now."
    >
      <MetricRow label="Tickets past SLA" value={flat.length} accent="var(--status-danger)" />
      <ul className="dashboard-widget__rows">
        {flat.slice(0, 5).map((t) => (
          <li key={t.id} className="dashboard-widget__row">
            <span className="truncate">{t.subject}</span>
            <span className="mono dim">{t.queueName}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function SupportByQueueWidget({ project }) {
  const { data, loading } = useQueueView(project.id);
  const queues = data?.queues ?? [];
  const segments = queues
    .map((q, i) => ({ label: q.name, value: q.openCount, color: QUEUE_COLORS[i % QUEUE_COLORS.length] }))
    .filter((s) => s.value > 0);
  return (
    <DashboardWidget
      title="Open by queue"
      eyebrow="Support"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="No queues with open tickets."
    >
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}
