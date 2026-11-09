import { DashboardWidget, MetricRow, ProgressBar, StackedBar, WidgetRows } from '../DashboardWidget';
import { SEGMENT_TOKENS } from '../segmentTokens';

// polish D: Support widgets read the server-computed `/analytics/support`
// aggregate (passed down by TypedDashboard). SLA attainment — the share of
// recently-resolved tickets that met their SLA — is the new depth metric.

const bandTone = (pct) => (pct == null ? undefined : pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'danger');

export function SupportOpenTicketsWidget({ data, loading }) {
  const open = data?.openCount ?? 0;
  const breached = data?.breachedOpenCount ?? 0;
  return (
    <DashboardWidget
      title="Open tickets"
      loading={loading}
      empty={!loading && open === 0}
      emptyText="Inbox zero."
    >
      <MetricRow
        label="Currently open"
        value={open}
        sublabel={breached > 0 ? `${breached} past SLA` : 'All within SLA'}
        tone={breached > 0 ? 'danger' : 'success'}
      />
    </DashboardWidget>
  );
}

export function SupportSlaAttainmentWidget({ data, loading }) {
  const pct = data?.slaAttainmentPct;
  const resolved = data?.resolvedCount ?? 0;
  const tone = bandTone(pct);
  return (
    <DashboardWidget
      title="SLA attainment"
      loading={loading}
      empty={!loading && resolved === 0}
      emptyText="No tickets resolved in the last 30 days yet."
    >
      <MetricRow
        label="Resolved within SLA · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={`${resolved} ticket${resolved === 1 ? '' : 's'} resolved`}
      />
      {pct != null && <ProgressBar pct={pct} tone={tone} />}
    </DashboardWidget>
  );
}

export function SupportSlaBreachWidget({ data, loading }) {
  const breaches = data?.breaches ?? [];
  return (
    <DashboardWidget
      title="SLA breaches"
      loading={loading}
      empty={!loading && breaches.length === 0}
      emptyText="No SLA breaches right now."
    >
      <MetricRow
        label="Tickets past SLA"
        value={data?.breachedOpenCount ?? 0}
        tone={breaches.length > 0 ? 'danger' : undefined}
      />
      <WidgetRows rows={breaches.map((t) => ({ key: t.id, label: t.subject, meta: t.queueName }))} />
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
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="No queues with open tickets."
    >
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}
