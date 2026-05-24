import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge, Icon } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { summaryForType } from '@/components/portfolio/portfolioRegistry';
import { PROJECT_TYPES, findProjectType } from '@/constants/projectTypes';
import './OrgPortfolioPage.css';

// F1.5-08 — org-level portfolio. Lists every project in the org and
// renders a type-appropriate summary card for each. No page-level type
// branches — each card's contents come from the registered summary
// component for that project's type. Adding a new project type means
// writing one new summary component and registering it.
//
// The full F3-19 portfolio (cross-project resource conflicts, org-wide
// metrics, drill-down filters) layers on top of this. F1.5-08 only
// requires the type-aware shape; F3-19 adds the cross-project rollups.
export function OrgPortfolioPage() {
  const { slug } = useParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    projectsApi.listForOrg(slug)
      .then((p) => !cancelled && setProjects(p))
      .catch((e) => !cancelled && setError(e.response?.data?.detail ?? 'Could not load projects.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [slug]);

  const typesPresent = useMemo(() => {
    const set = new Set();
    for (const p of projects) set.add(p.type);
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
              <Badge tone="neutral">{projects.length}</Badge>
            </h1>
            <div className="page-subtitle">
              Every project in this organisation, summarised by its type.
            </div>
          </div>
        </div>
      </div>

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

      {loading ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="muted">No projects in this organisation yet.</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No projects match this filter.</p>
      ) : (
        <ul className="portfolio-page-grid">
          {filtered.map((p) => {
            const Summary = summaryForType(p.type);
            const meta = findProjectType(p.type);
            const TypeIcon = meta?.icon;
            return (
              <li key={p.id} className="portfolio-page-item">
                <Link
                  to={`/${slug}/projects/${p.slug}/dashboard`}
                  className="portfolio-page-item-head"
                >
                  <span className="row" style={{ gap: 6 }}>
                    {TypeIcon && <TypeIcon size={12} aria-hidden="true" />}
                    <span className="portfolio-page-item-title">{p.name}</span>
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    <Badge tone="neutral">{meta?.label ?? p.type}</Badge>
                    <span className="mono muted portfolio-page-item-key">{p.key}</span>
                  </span>
                </Link>
                {Summary ? (
                  <Summary project={p} />
                ) : (
                  <p className="muted portfolio-page-no-summary">
                    No summary registered for {p.type}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
