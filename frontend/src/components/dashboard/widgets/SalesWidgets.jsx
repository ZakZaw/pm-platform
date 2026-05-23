import { useEffect, useState } from 'react';
import { salesApi } from '@/api/sales.api';
import { DashboardWidget, MetricRow, StackedBar } from '../DashboardWidget';

const STAGE_COLORS = ['#5B6AF0', '#4FD1E0', '#7A6BFF', '#C77BFF', '#3FB984', '#E0A23A', '#E5484D'];

function pipelineSegments(pipeline) {
  if (!pipeline?.stages) return [];
  return pipeline.stages.map((s, i) => ({
    label: s.name,
    value: s.deals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    color: STAGE_COLORS[i % STAGE_COLORS.length],
  }));
}

function totalValue(pipeline) {
  if (!pipeline?.stages) return 0;
  let sum = 0;
  for (const s of pipeline.stages) for (const d of s.deals) sum += d.value ?? 0;
  return sum;
}

function formatMoney(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

export function SalesPipelineValueWidget({ project }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    salesApi.getPipeline(project.id)
      .then((p) => { if (!cancelled) setPipeline(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  const total = totalValue(pipeline);
  const currency = pipeline?.stages?.[0]?.deals?.[0]?.currency ?? 'USD';
  const segments = pipelineSegments(pipeline).filter((s) => s.value > 0);

  return (
    <DashboardWidget
      title="Pipeline value by stage"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="No open deals yet."
    >
      <MetricRow label="Total open pipeline" value={formatMoney(total, currency)} />
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}

export function SalesConversionWidget({ project }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    salesApi.getPipeline(project.id)
      .then((p) => { if (!cancelled) setPipeline(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  // Funnel: stage with most deals at the top, then descending. Last stage
  // typically has the won deals.
  const stages = pipeline?.stages ?? [];
  const counts = stages.map((s) => ({ name: s.name, count: s.deals.length }));
  const max = counts.reduce((m, x) => Math.max(m, x.count), 0);

  return (
    <DashboardWidget
      title="Conversion funnel"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && counts.every((c) => c.count === 0)}
      emptyText="Deals will appear here once added."
    >
      <ul className="dashboard-widget__rows">
        {counts.map((c) => {
          const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
          return (
            <li key={c.name} className="dashboard-widget__row" style={{ position: 'relative' }}>
              <span style={{ position: 'relative', zIndex: 1 }}>{c.name}</span>
              <span className="mono dim" style={{ position: 'relative', zIndex: 1 }}>{c.count}</span>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(to right, var(--accent-primary-soft) 0%, var(--accent-primary-soft) ${pct}%, transparent ${pct}%)`,
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </li>
          );
        })}
      </ul>
    </DashboardWidget>
  );
}

export function SalesDealsAtRiskWidget({ project }) {
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    salesApi.getPipeline(project.id)
      .then((p) => { if (!cancelled) setPipeline(p); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  // "At risk" heuristic: probability < 30 and expected-close within
  // 14 days. No bespoke endpoint yet (Phase 2 analytics will replace
  // this with a server-side definition).
  const now = Date.now();
  const twoWeeks = 14 * 86_400_000;
  const atRisk = [];
  for (const s of pipeline?.stages ?? []) {
    for (const d of s.deals ?? []) {
      const close = d.expectedClose ? new Date(d.expectedClose).getTime() : null;
      const dueSoon = close !== null && close - now <= twoWeeks;
      if ((d.probability ?? 0) < 30 && dueSoon) atRisk.push({ ...d, stage: s.name });
    }
  }

  return (
    <DashboardWidget
      title="Deals at risk"
      eyebrow="Sales"
      loading={loading}
      empty={!loading && atRisk.length === 0}
      emptyText="No at-risk deals — low probability with close in next 14 days."
    >
      <MetricRow label="Flagged" value={atRisk.length} accent="var(--status-danger)" />
      <ul className="dashboard-widget__rows">
        {atRisk.slice(0, 5).map((d) => (
          <li key={d.id} className="dashboard-widget__row">
            <span className="truncate">{d.name}</span>
            <span className="mono dim">{d.probability ?? 0}% · {d.stage}</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}
