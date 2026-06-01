import { DashboardWidget, MetricRow, StackedBar, SEGMENT_TOKENS } from '../DashboardWidget';

// polish D: Sales widgets read the server-computed `/analytics/sales`
// aggregate (passed down by TypedDashboard) instead of re-deriving pipeline
// math client-side from the raw deal list.

function formatMoney(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  } catch {
    return `$${Math.round(value ?? 0)}`;
  }
}

export function SalesPipelineValueWidget({ data, loading }) {
  const segments = (data?.funnel ?? [])
    .filter((s) => s.value > 0)
    .map((s, i) => ({ label: s.name, value: s.value, color: SEGMENT_TOKENS[i % SEGMENT_TOKENS.length] }));
  const currency = data?.currency ?? 'USD';

  return (
    <DashboardWidget
      title="Pipeline value by stage"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="No open deals yet."
    >
      <MetricRow label="Total open pipeline" value={formatMoney(data?.openPipelineValue, currency)} />
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}

export function SalesForecastWidget({ data, loading }) {
  const currency = data?.currency ?? 'USD';
  const winRate = data?.winRatePct;
  return (
    <DashboardWidget
      title="Weighted forecast"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && !data}
      emptyText="No pipeline to forecast yet."
    >
      <MetricRow
        label="Probability-weighted open pipeline"
        value={formatMoney(data?.weightedForecast, currency)}
        sublabel={`of ${formatMoney(data?.openPipelineValue, currency)} total open`}
      />
      <MetricRow
        label="Won · last 90 days"
        value={formatMoney(data?.wonValue, currency)}
        sublabel={
          winRate == null
            ? `${data?.wonCount ?? 0} won · ${data?.lostCount ?? 0} lost`
            : `${winRate}% win rate · ${data?.wonCount ?? 0} won / ${data?.lostCount ?? 0} lost`
        }
        accent={winRate != null && winRate >= 50 ? 'var(--success)' : undefined}
      />
    </DashboardWidget>
  );
}

export function SalesConversionWidget({ data, loading }) {
  const funnel = data?.funnel ?? [];
  return (
    <DashboardWidget
      title="Conversion funnel"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && funnel.every((s) => s.count === 0)}
      emptyText="Deals will appear here once added."
    >
      <ul className="dashboard-widget__rows">
        {funnel.map((s) => (
          <li key={s.name} className="dashboard-widget__row" style={{ position: 'relative' }}>
            <span style={{ position: 'relative', zIndex: 1 }}>{s.name}</span>
            <span className="mono dim" style={{ position: 'relative', zIndex: 1 }}>
              {s.count} · {Math.round(s.conversionPct)}%
            </span>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to right, var(--accent-soft) 0%, var(--accent-soft) ${s.conversionPct}%, transparent ${s.conversionPct}%)`,
                borderRadius: 'var(--r-sm)',
              }}
            />
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function SalesDealsAtRiskWidget({ data, loading }) {
  const atRisk = data?.dealsAtRisk ?? [];
  return (
    <DashboardWidget
      title="Deals at risk"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && atRisk.length === 0}
      emptyText="No at-risk deals — low probability with close in the next 14 days."
    >
      <MetricRow label="Flagged" value={atRisk.length} accent={atRisk.length > 0 ? 'var(--danger)' : undefined} />
      <ul className="dashboard-widget__rows">
        {atRisk.map((d) => (
          <li key={d.id} className="dashboard-widget__row">
            <span className="truncate">{d.name}</span>
            <span className="mono dim">{d.probability}% · {d.stageName}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
