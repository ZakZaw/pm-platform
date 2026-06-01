import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar, Badge, Icon, Skeleton } from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import { PROJECT_TYPES, findProjectType } from '@/constants/projectTypes';
import './OrgPortfolioPage.css';

// F3-19 (AN-09) — org portfolio dashboard. One server-side aggregate
// (orgsApi.portfolio) rolls up every project in the org: a type-agnostic
// health score + a type-appropriate headline metric per project, an org-level
// rollup strip, and the cross-project resource-conflict list (people carrying
// open work across 2+ projects). No page-level type branches and no per-card
// N+1 fetching — the backend does the aggregation. Drill into any project's
// own dashboard from its card.

const BAND_TONE = { Healthy: 'success', 'At risk': 'warning', Critical: 'danger' };

function HealthBar({ health, band }) {
  const tone = BAND_TONE[band] ?? 'neutral';
  return (
    <div className="portfolio-health" title={`Health ${health} · ${band}`}>
      <div className="portfolio-health-track">
        <div
          className={`portfolio-health-fill is-${tone}`}
          style={{ width: `${Math.max(4, health)}%` }}
        />
      </div>
      <Badge tone={tone}>{band}</Badge>
    </div>
  );
}

function ResourceConflicts({ conflicts, slug, projectsBySlug }) {
  return (
    <section className="portfolio-conflicts">
      <header className="portfolio-conflicts-head">
        <strong className="row gap-3">
          <Icon name="users" size={15} /> Resource conflicts
        </strong>
        <span className="muted portfolio-conflicts-sub">
          People carrying open work across multiple projects, most-split first.
        </span>
      </header>
      <ul className="portfolio-conflicts-list">
        {conflicts.map((c) => (
          <li key={c.userId} className="portfolio-conflict">
            <Avatar name={c.name} src={c.avatarUrl} size="sm" />
            <div className="portfolio-conflict-body">
              <div className="portfolio-conflict-top">
                <span className="portfolio-conflict-name">{c.name}</span>
                <Badge tone={c.projectCount >= 3 ? 'danger' : 'warning'}>
                  {c.projectCount} projects
                </Badge>
                <span className="muted portfolio-conflict-total">
                  {c.totalOpenItems} open item{c.totalOpenItems === 1 ? '' : 's'}
                </span>
              </div>
              <div className="portfolio-conflict-allocs">
                {c.allocations.map((a) => {
                  const ps = projectsBySlug.get(a.projectId);
                  const chip = (
                    <>
                      <span className="portfolio-alloc-name">{a.projectName}</span>
                      <span className="mono portfolio-alloc-count">{a.openItems}</span>
                    </>
                  );
                  return ps ? (
                    <Link
                      key={a.projectId}
                      to={`/${slug}/projects/${ps.slug}/dashboard`}
                      className="portfolio-alloc"
                    >
                      {chip}
                    </Link>
                  ) : (
                    <span key={a.projectId} className="portfolio-alloc">{chip}</span>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrgPortfolioPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgsApi.portfolio(slug)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.response?.data?.detail ?? 'Could not load portfolio.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [slug]);

  const projects = data?.projects ?? [];
  const rollup = data?.rollup;
  const conflicts = data?.resourceConflicts ?? [];

  const projectsBySlug = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const typesPresent = useMemo(() => {
    const set = new Set(projects.map((p) => p.type));
    return PROJECT_TYPES.filter((t) => set.has(t.id));
  }, [projects]);

  const filtered = activeFilter === 'All'
    ? projects
    : projects.filter((p) => p.type === activeFilter);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner portfolio-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Organisation</div>
            <h1 className="page-title row gap-3">
              <Icon name="briefcase" size={18} />
              Portfolio
              {rollup && <Badge tone="neutral">{rollup.projectCount}</Badge>}
            </h1>
            <div className="page-subtitle">
              Every project in this organisation, rolled up by health and shared load.
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="portfolio-rollup">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={68} radius="md" />)}
        </div>
      ) : !rollup || rollup.projectCount === 0 ? (
        <p className="muted" style={{ padding: 'var(--s-7)' }}>No projects in this organisation yet.</p>
      ) : (
        <>
          <div className="portfolio-rollup">
            <div className="stat">
              <div className="stat-label">Projects</div>
              <div className="stat-value">{rollup.projectCount}</div>
            </div>
            <div className="stat">
              <div className="stat-label">At risk</div>
              <div className={`stat-value ${rollup.atRiskCount > 0 ? 'portfolio-stat-danger' : ''}`}>
                {rollup.atRiskCount}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Open items</div>
              <div className="stat-value">{rollup.totalOpenItems}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Overdue</div>
              <div className={`stat-value ${rollup.totalOverdue > 0 ? 'portfolio-stat-warning' : ''}`}>
                {rollup.totalOverdue}
              </div>
            </div>
          </div>

          {conflicts.length > 0 && (
            <ResourceConflicts conflicts={conflicts} slug={slug} projectsBySlug={projectsBySlug} />
          )}

          {typesPresent.length > 1 && (
            <div className="portfolio-page-filters">
              <span className="muted portfolio-page-filter-label">Project type</span>
              <button
                type="button"
                onClick={() => setActiveFilter('All')}
                className={['portfolio-page-chip', activeFilter === 'All' ? 'is-active' : ''].filter(Boolean).join(' ')}
              >All</button>
              {typesPresent.map((t) => {
                const TypeIcon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveFilter(t.id)}
                    className={['portfolio-page-chip', activeFilter === t.id ? 'is-active' : ''].filter(Boolean).join(' ')}
                  >
                    <TypeIcon size={11} aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="portfolio-page-grid">
            {filtered.map((p) => {
              const meta = findProjectType(p.type);
              const TypeIcon = meta?.icon;
              return (
                <li key={p.id} className="portfolio-card">
                  <Link
                    to={`/${slug}/projects/${p.slug}/dashboard`}
                    className="portfolio-card-head"
                  >
                    <span className="row" style={{ gap: 6, minWidth: 0 }}>
                      {TypeIcon && <TypeIcon size={12} aria-hidden="true" />}
                      <span className="portfolio-card-title">{p.name}</span>
                    </span>
                    <span className="mono muted portfolio-card-key">{p.key}</span>
                  </Link>

                  <HealthBar health={p.health} band={p.band} />

                  <div className="portfolio-card-headline">
                    <span className="portfolio-card-headline-value">{p.headlineValue}</span>
                    <span className="muted portfolio-card-headline-label">{p.headlineLabel}</span>
                  </div>

                  <div className="portfolio-card-counts">
                    {p.overdue > 0 && (
                      <span className="portfolio-count is-warning">{p.overdue} overdue</span>
                    )}
                    {p.atRisk > 0 && (
                      <span className="portfolio-count is-danger">{p.atRisk} at risk</span>
                    )}
                    {p.overdue === 0 && p.atRisk === 0 && (
                      <span className="portfolio-count is-ok">On track</span>
                    )}
                    <Badge tone="neutral">{meta?.label ?? p.type}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
