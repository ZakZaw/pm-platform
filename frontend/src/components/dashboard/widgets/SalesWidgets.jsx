import { DashboardWidget, MetricRow, ProgressBar, StackedBar, WidgetRows } from '../DashboardWidget';
import { SEGMENT_TOKENS } from '../segmentTokens';

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
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="No open deals yet."
    >
      <MetricRow label="Total open pipeline" value={formatMoney(data?.openPipelineValue, currency)} />
      {segments.length > 0 && (
        <StackedBar segments={segments} format={(v) => formatMoney(v, currency)} />
      )}
    </DashboardWidget>
  );
}

export function SalesForecastWidget({ data, loading }) {
  const currency = data?.currency ?? 'USD';
  const winRate = data?.winRatePct;
  return (
    <DashboardWidget
      title="Weighted forecast"
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
        tone={winRate != null && winRate >= 50 ? 'success' : undefined}
      />
    </DashboardWidget>
  );
}

export function SalesConversionWidget({ data, loading }) {
  const funnel = data?.funnel ?? [];
  return (
    <DashboardWidget
      title="Conversion funnel"
      loading={loading}
      empty={!loading && funnel.every((s) => s.count === 0)}
      emptyText="Deals will appear here once added."
    >
      <ul className="dashboard-widget-funnel">
        {funnel.map((s) => (
          <li key={s.name}>
            <div className="dashboard-widget-row">
              <span className="truncate">{s.name}</span>
              <span className="dashboard-widget-row-meta">
                {s.count} · {Math.round(s.conversionPct)}%
              </span>
            </div>
            <ProgressBar pct={s.conversionPct} />
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
      loading={loading}
      empty={!loading && atRisk.length === 0}
      emptyText="No at-risk deals — low probability with close in the next 14 days."
    >
      <MetricRow label="Flagged" value={atRisk.length} tone={atRisk.length > 0 ? 'danger' : undefined} />
      <WidgetRows
        rows={atRisk.map((d) => ({ key: d.id, label: d.name, meta: `${d.probability}% · ${d.stageName}` }))}
      />
    </DashboardWidget>
  );
}
