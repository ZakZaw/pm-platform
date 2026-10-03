import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar, Icon, Segmented, Skeleton } from '@/components/ui';
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
      <div className="bar portfolio-health-track">
        <div
          className={`bar-fill portfolio-health-fill is-${tone}`}
          style={{ width: `${Math.max(4, health)}%` }}
        />
      </div>
      <span className={`portfolio-band is-${tone}`}>
        {band} <span className="portfolio-band-score">{health}</span>
      </span>
    </div>
  );
}

function ResourceConflicts({ conflicts, slug, projectsBySlug }) {
  return (
    <section className="card portfolio-conflicts">
      <header className="portfolio-conflicts-head">
        <span className="portfolio-icon-badge" aria-hidden="true">
          <Icon name="users" size={16} />
        </span>
        <div>
          <h2 className="h-card">Resource conflicts</h2>
          <p className="muted portfolio-conflicts-sub">
            People carrying open work across multiple projects, most-split first.
          </p>
        </div>
      </header>
      <ul className="portfolio-conflicts-list">
        {conflicts.map((c) => (
          <li key={c.userId} className="portfolio-conflict">
            <Avatar name={c.name} src={c.avatarUrl} size="sm" />
            <div className="portfolio-conflict-body">
              <div className="portfolio-conflict-top">
                <span className="portfolio-conflict-name">{c.name}</span>
                <span className={`portfolio-conflict-count is-${c.projectCount >= 3 ? 'danger' : 'warning'}`}>
                  {c.projectCount} projects
                </span>
                <span className="muted portfolio-conflict-total">
                  · {c.totalOpenItems} open item{c.totalOpenItems === 1 ? '' : 's'}
                </span>
              </div>
              <div className="portfolio-conflict-allocs">
                {c.allocations.map((a) => {
                  const ps = projectsBySlug.get(a.projectId);
                  const chip = (
                    <>
                      <span className="portfolio-alloc-name">{a.projectName}</span>
                      <span className="portfolio-alloc-count">{a.openItems}</span>
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

  const filterOptions = useMemo(
    () => [
      { value: 'All', label: 'All' },
      ...typesPresent.map((t) => ({ value: t.id, label: t.label })),
    ],
    [typesPresent],
  );

  const filtered = activeFilter === 'All'
    ? projects
    : projects.filter((p) => p.type === activeFilter);

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner portfolio-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow portfolio-eyebrow">Organisation</div>
            <h1 className="page-title">Portfolio</h1>
            <p className="page-subtitle">
              Every project in this organisation, rolled up by health and shared load.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={68} radius="md" />)}
        </div>
      ) : !rollup || rollup.projectCount === 0 ? (
        <div className="card empty">
          <div className="empty-title">No projects yet</div>
          <p className="empty-desc">No projects in this organisation yet.</p>
        </div>
      ) : (
        <>
          <div className="grid-4 portfolio-rollup">
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

          <div className="between portfolio-section-head">
            <h2 className="h-card">Projects</h2>
            {typesPresent.length > 1 && (
              <Segmented
                value={activeFilter}
                onChange={setActiveFilter}
                options={filterOptions}
                ariaLabel="Project type"
              />
            )}
          </div>

          <ul className="portfolio-page-grid">
            {filtered.map((p) => {
              const meta = findProjectType(p.type);
              const tint = (meta?.id ?? 'generic').toLowerCase();
              return (
                <li key={p.id} className="card portfolio-card">
                  <Link
                    to={`/${slug}/projects/${p.slug}/dashboard`}
                    className="portfolio-card-head"
                  >
                    <span className={`proj-icon proj-icon-${tint}`} aria-hidden="true">
                      {meta?.short?.[0] ?? '·'}
                    </span>
                    <span className="portfolio-card-titles">
                      <span className="portfolio-card-title">{p.name}</span>
                      <span className="portfolio-card-sub">
                        <span className="mono">{p.key}</span> · {meta?.label ?? p.type}
                      </span>
                    </span>
                  </Link>

                  <div className="portfolio-card-headline">
                    <span className="portfolio-card-headline-value">{p.headlineValue}</span>
                    <span className="muted portfolio-card-headline-label">{p.headlineLabel}</span>
                  </div>

                  <HealthBar health={p.health} band={p.band} />

                  <div className="portfolio-card-counts">
                    {p.overdue > 0 && (
                      <span className="status portfolio-count is-warning">{p.overdue} overdue</span>
                    )}
                    {p.atRisk > 0 && (
                      <span className="status status-blocked">{p.atRisk} at risk</span>
                    )}
                    {p.overdue === 0 && p.atRisk === 0 && (
                      <span className="status status-done">On track</span>
                    )}
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