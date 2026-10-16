import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { AIChip, Badge, Button, Skeleton, Sparkline } from '@/components/ui';
import { analyticsApi } from '@/api/analytics.api';
import { useAuthStore } from '@/store/authStore';
import { findProjectType } from '@/constants/projectTypes';
import { deltaClass, formatSigned } from '@/utils/formatMetrics';
import { buildHomeKpis } from './homeKpis';
import './HomePage.css';

// Personal status tone (server keyword) → dot-status class from stratos.css.
const STATUS_CLASS = {
  success: 'status-done',
  warning: 'status-warning',
  danger: 'status-blocked',
  neutral: 'status-todo',
};

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    analyticsApi
      .myHome()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load your dashboard.');
      });
    return () => { cancelled = true; };
  }, []);

  const kpis = buildHomeKpis(data?.kpis ?? null);
  const throughput = (data?.throughput ?? []).map((w) => w.count);
  const hasThroughput = throughput.some((n) => n > 0);
  const throughputDelta = formatSigned(data?.throughputChangePct, '%');
  const insight = data?.insight;
  const projectRows = data?.projects ?? [];

  return (
    <div className="main-inner home">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow home-eyebrow">Welcome back</div>
            <h1 className="page-title">
              {user?.fullName ? user.fullName.split(' ')[0] : 'there'}
            </h1>
            <p className="page-subtitle">
              Your performance across every project over the last 30 days.
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="secondary" size="md">
              <Zap size={14} aria-hidden="true" /> Go to My work
            </Button>
          </Link>
        </div>
      </div>

      {error && <p className="muted home-placeholder">{error}</p>}

      <div className="grid-4 home-kpis" aria-busy={!data && !error}>
        {!data && !error
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} radius="lg" />)
          : kpis.map(({ label, value, delta, good, hint, tone, icon: Icon }) => (
            <div key={label} className="stat">
              <div className="home-kpi-head">
                <span className={`home-icon-badge is-${tone}`}>
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="home-kpi-label">{label}</span>
              </div>
              <div className="stat-row">
                <div className="stat-value">{value}</div>
                {delta && <span className={`stat-delta ${deltaClass(good)}`}>{delta}</span>}
              </div>
              {hint && <div className="muted home-kpi-hint">{hint}</div>}
            </div>
          ))}
      </div>

      <div className="grid-12">
        <div className="card home-card col-8">
          <div className="between home-card-head">
            <div>
              <h2 className="h-card">Weekly throughput</h2>
              <p className="muted home-card-sub">Tasks, tickets and runs you completed per week · last 12 weeks</p>
            </div>
            {throughputDelta && (
              <span className={`stat-delta ${deltaClass((data?.throughputChangePct ?? 0) >= 0)}`}>
                {throughputDelta}
              </span>
            )}
          </div>
          {data && !hasThroughput ? (
            <p className="muted home-placeholder">
              Nothing completed in the last 12 weeks yet — your weekly trend appears here as you finish work.
            </p>
          ) : (
            <Sparkline
              points={throughput}
              width={520}
              height={120}
              stroke="var(--accent)"
              className="home-trend"
            />
          )}
        </div>

        <div className="card-ai home-insight col-4">
          <AIChip label="Weekly insight" variant="soft" />
          {insight ? (
            <>
              <div className="home-insight-title">{insight.headline}</div>
              <p className="muted home-insight-body">{insight.detail}</p>
              {insight.highlights?.length > 0 && (
                <div className="row gap-2 home-insight-chips">
                  {insight.highlights.map((h) => (
                    <Badge key={h} tone="neutral">{h}</Badge>
                  ))}
                </div>
              )}
            </>
          ) : (
            !error && <Skeleton rows={3} />
          )}
        </div>

        <div className="card home-card col-12">
          <h2 className="h-card home-card-head">Per project</h2>
          {data && projectRows.length === 0 ? (
            <p className="muted home-placeholder">
              You're not in any projects yet — create or join one to see per-project performance.
            </p>
          ) : (
            <ul className="home-project-list">
              {projectRows.map((p) => {
                const meta = findProjectType(p.type);
                const tint = (meta?.id ?? 'generic').toLowerCase();
                const stats = [
                  `${p.openItems} open`,
                  p.openPoints > 0 ? `${p.openPoints} pt` : null,
                  p.overdue > 0 ? `${p.overdue} overdue` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <li key={p.projectId}>
                    <Link
                      to={`/${p.orgSlug}/projects/${p.slug}/dashboard`}
                      className="home-project-row"
                    >
                      <span className={`proj-icon proj-icon-${tint}`} aria-hidden="true">
                        {p.name?.[0]?.toUpperCase() ?? '·'}
                      </span>
                      <span className="home-project-meta">
                        <span className="home-project-name truncate">{p.name}</span>
                        <span className="mono muted home-project-key">{p.key ?? '··'}</span>
                      </span>
                      <span className="muted home-project-stats">{stats}</span>
                      <span className={`status ${STATUS_CLASS[p.statusTone] ?? 'status-todo'}`}>{p.status}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
