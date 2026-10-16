import { DashboardWidget, MetricRow, ProgressBar, WidgetRows } from '../DashboardWidget';

// polish D: Operations widgets read the server-computed `/analytics/operations`
// aggregate (passed down by TypedDashboard). Completion / on-time / skip rates
// are now computed over the trailing 30 days of scheduled runs — the honest
// replacement for the old "was the last run skipped?" heuristic.

function fmtRunDate(value) {
  return new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function OperationsCompletionWidget({ data, loading }) {
  const pct = data?.completionPct;
  const onTime = data?.onTimePct;
  const total = data?.windowTotal ?? 0;
  const tone = pct == null ? undefined : pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'danger';
  return (
    <DashboardWidget
      title="Run completion"
      loading={loading}
      empty={!loading && total === 0}
      emptyText="No runs scheduled in the last 30 days."
    >
      <MetricRow
        label="Completed · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={onTime == null ? `${total} runs scheduled` : `${onTime}% on time · ${total} runs scheduled`}
      />
      {pct != null && <ProgressBar pct={pct} tone={tone} />}
    </DashboardWidget>
  );
}

export function OperationsNext7DaysWidget({ data, loading }) {
  const upcoming = data?.upcoming ?? [];
  return (
    <DashboardWidget
      title="Next 7 days"
      loading={loading}
      empty={!loading && (data?.next7DaysCount ?? 0) === 0}
      emptyText="No runs scheduled in the next week."
    >
      <MetricRow label="Runs scheduled" value={data?.next7DaysCount ?? 0} />
      <WidgetRows
        rows={upcoming.map((r) => ({ key: r.runId, label: r.workflowName, meta: fmtRunDate(r.scheduledFor) }))}
      />
    </DashboardWidget>
  );
}

export function OperationsOverdueRunsWidget({ data, loading }) {
  const overdue = data?.overdue ?? [];
  return (
    <DashboardWidget
      title="Overdue runs"
      loading={loading}
      empty={!loading && (data?.overdueCount ?? 0) === 0}
      emptyText="No overdue runs."
    >
      <MetricRow
        label="Past their scheduled time"
        value={data?.overdueCount ?? 0}
        tone={(data?.overdueCount ?? 0) > 0 ? 'danger' : undefined}
      />
      <WidgetRows
        rows={overdue.map((r) => ({ key: r.runId, label: r.workflowName, meta: fmtRunDate(r.scheduledFor) }))}
      />
    </DashboardWidget>
  );
}

export function OperationsSkipRateWidget({ data, loading }) {
  const pct = data?.skipPct;
  const total = data?.windowTotal ?? 0;
  return (
    <DashboardWidget
      title="Skip rate"
      loading={loading}
      empty={!loading && total === 0}
      emptyText="No runs scheduled in the last 30 days."
    >
      <MetricRow
        label="Runs skipped · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={`${total} runs scheduled`}
        tone={pct != null && pct >= 20 ? 'warning' : undefined}
      />
    </DashboardWidget>
  );
}
