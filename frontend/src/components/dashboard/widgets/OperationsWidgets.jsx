import { DashboardWidget, MetricRow } from '../DashboardWidget';

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
  const accent = pct == null ? undefined : pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';
  return (
    <DashboardWidget
      title="Run completion"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && total === 0}
      emptyText="No runs scheduled in the last 30 days."
    >
      <MetricRow
        label="Completed · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={onTime == null ? `${total} runs scheduled` : `${onTime}% on time · ${total} runs scheduled`}
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

export function OperationsNext7DaysWidget({ data, loading }) {
  const upcoming = data?.upcoming ?? [];
  return (
    <DashboardWidget
      title="Next 7 days"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && (data?.next7DaysCount ?? 0) === 0}
      emptyText="No runs scheduled in the next week."
    >
      <MetricRow label="Runs scheduled" value={data?.next7DaysCount ?? 0} />
      <ul className="dashboard-widget__rows">
        {upcoming.map((r) => (
          <li key={r.runId} className="dashboard-widget__row">
            <span className="truncate">{r.workflowName}</span>
            <span className="mono dim">{fmtRunDate(r.scheduledFor)}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function OperationsOverdueRunsWidget({ data, loading }) {
  const overdue = data?.overdue ?? [];
  return (
    <DashboardWidget
      title="Overdue runs"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && (data?.overdueCount ?? 0) === 0}
      emptyText="No overdue runs."
    >
      <MetricRow
        label="Past their scheduled time"
        value={data?.overdueCount ?? 0}
        accent={(data?.overdueCount ?? 0) > 0 ? 'var(--danger)' : undefined}
      />
      <ul className="dashboard-widget__rows">
        {overdue.map((r) => (
          <li key={r.runId} className="dashboard-widget__row">
            <span className="truncate">{r.workflowName}</span>
            <span className="mono dim">{fmtRunDate(r.scheduledFor)}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function OperationsSkipRateWidget({ data, loading }) {
  const pct = data?.skipPct;
  const total = data?.windowTotal ?? 0;
  return (
    <DashboardWidget
      title="Skip rate"
      eyebrow="Operations"
      loading={loading}
      empty={!loading && total === 0}
      emptyText="No runs scheduled in the last 30 days."
    >
      <MetricRow
        label="Runs skipped · last 30 days"
        value={pct == null ? '—' : `${pct}%`}
        sublabel={`${total} runs scheduled`}
        accent={pct != null && pct >= 20 ? 'var(--warning)' : undefined}
      />
    </DashboardWidget>
  );
}
