import { DashboardWidget, MetricRow, StackedBar, SEGMENT_TOKENS } from '../DashboardWidget';

// polish D: Support widgets read the server-computed `/analytics/support`
// aggregate (passed down by TypedDashboard). SLA attainment — the share of
// recently-resolved tickets that met their SLA — is the new depth metric.

export function SupportOpenTicketsWidget({ data, loading }) {
  const open = data?.openCount ?? 0;
  const breached = data?.breachedOpenCount ?? 0;
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
        accent={breached > 0 ? 'var(--danger)' : undefined}
      />
    </DashboardWidget>
  );
}

export function SupportSlaAttainmentWidget({ data, loading }) {
  const pct = data?.slaAttainmentPct;
  const resolved = data?.resolvedCount ?? 0;
  const accent = pct == null ? undefined : pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';
  return (
    <DashboardWidget
      title="SLA attainment"
      eyebrow="Support"
      loading={loading}
      empty={!loading && resolved === 0}
      emptyText="No tickets resolved in the last 30 days yet."
    >
      <MetricRow
        label="Resolved within SLA · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={`${resolved} ticket${resolved === 1 ? '' : 's'} resolved`}
        accent={accent}
      />
      {pct != null && (
        <div className="dashboard-widget__bar" aria-hidden="true">
          <span
            className="dashboard-widget__bar-seg"
            style={{ width: `${pct}%`, background: accent ?? 'var(--accent)' }}
          />
        </div>
      )}
    </DashboardWidget>
  );
}

export function SupportSlaBreachWidget({ data, loading }) {
  const breaches = data?.breaches ?? [];
  return (
    <DashboardWidget
      title="SLA breaches"
      eyebrow="Support"
      loading={loading}
      empty={!loading && breaches.length === 0}
      emptyText="No SLA breaches right now."
    >
      <MetricRow label="Tickets past SLA" value={data?.breachedOpenCount ?? 0} accent={breaches.length > 0 ? 'var(--danger)' : undefined} />
      <ul className="dashboard-widget__rows">
        {breaches.map((t) => (
          <li key={t.id} className="dashboard-widget__row">
            <span className="truncate">{t.subject}</span>
            <span className="mono dim">{t.queueName}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function SupportByQueueWidget({ data, loading }) {
  const segments = (data?.queues ?? [])
    .map((q, i) => ({ label: q.name, value: q.openCount, color: SEGMENT_TOKENS[i % SEGMENT_TOKENS.length] }))
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
