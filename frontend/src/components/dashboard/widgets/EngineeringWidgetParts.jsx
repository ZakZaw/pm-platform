// Presentational building blocks for the engineering dashboard widgets
// (registry lives in ../engineeringWidgets.jsx). Kept in their own module so
// the registry file only exports data and Fast Refresh keeps working.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar, Skeleton } from '@/components/ui';
import { activityApi } from '@/api/activity.api';
import { describeActivity, relativeTime } from '@/utils/activityFormat';
import '../DashboardWidget.css';

// Dot + coloured text status read-out (no capsule).
export function Tone({ tone = 'neutral', children }) {
  return <span className={`dash-tone dash-tone-${tone}`}>{children}</span>;
}

// Measures its own box so SVG charts render at the widget's real size (the
// canvas is resizable) while the chart components keep their explicit
// width/height props.
export function ChartFrame({ minHeight = 120, children }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.floor(r.width), h: Math.max(minHeight, Math.floor(r.height)) };
      setSize((cur) => (cur && cur.w === next.w && cur.h === next.h ? cur : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight]);
  return (
    <div ref={ref} className="dash-chart">
      {size && size.w > 0 && children(size.w, size.h)}
    </div>
  );
}

export function KpiCard({ label, value, delta, tone = 'info' }) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-row">
        <div className="dash-kpi-value">{value}</div>
        {delta && (
          <span className={`stat-delta stat-delta-${tone === 'warning' || tone === 'danger' ? 'down' : 'up'}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export function WidgetHead({ title, children }) {
  return (
    <header className="dash-card-head">
      <h3 className="dash-card-title">{title}</h3>
      {children}
    </header>
  );
}

export function Empty({ children }) {
  return <p className="dash-empty">{children}</p>;
}

// ---------- Activity feed (F2-04 wire-up) ----------

export function ActivityFeedWidget({ project, refreshKey }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!project?.id) return undefined;
    let cancelled = false;
    activityApi
      .listForProject(project.id, { limit: 12 })
      .then((r) => {
        if (cancelled) return;
        setEntries(r.entries ?? []);
        setError(null);
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load activity.'); });
    return () => { cancelled = true; };
  }, [project?.id, refreshKey]);

  return (
    <div className="dash-card">
      <WidgetHead title="Recent activity" />
      <div className="dash-activity">
        {entries === null && !error && <Skeleton height={14} width="60%" />}
        {error && <Empty>{error}</Empty>}
        {entries && entries.length === 0 && !error && <Empty>No activity in this project yet.</Empty>}
        {entries && entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

export function ActivityRow({ entry }) {
  const actorName = entry.actor?.fullName ?? 'Someone';
  return (
    <div className="dash-activity-row">
      <Avatar name={actorName} src={entry.actor?.avatarUrl} size="sm" />
      <span className="dash-activity-text">
        <span className="dash-activity-actor">{actorName}</span>{' '}
        <span className="muted">{describeActivity(entry)}</span>
      </span>
      <span className="dash-activity-time" title={new Date(entry.createdAt).toLocaleString()}>
        {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}
