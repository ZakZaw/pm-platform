import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  Flame,
  Info,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { AIChip, Button, Sparkline } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { findProjectType } from '@/constants/projectTypes';
import './HomePage.css';

// Placeholder data only — the real backend endpoints land in Phase 2
// (F2-04 dashboard / F3-16 health-score / F3-18 weekly insight).
// The page states this once, quietly, under the title.
const KPI_TILES = [
  { label: 'Tasks completed', value: '47', delta: '+12', tone: 'success', icon: Trophy },
  { label: 'Avg cycle time', value: '2.8d', delta: '−0.4d', tone: 'success', icon: Clock },
  { label: 'Current streak', value: '6d', delta: 'on fire', tone: 'warning', icon: Flame },
  { label: 'Velocity (5-sprint)', value: '38pt', delta: '+3pt', tone: 'info', icon: TrendingUp },
];

const PLACEHOLDER_TREND = [22, 25, 21, 28, 30, 27, 32, 35, 31, 38, 36, 42];

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const orgs = useOrgStore((s) => s.orgs);
  const projectsByOrg = useProjectStore((s) => s.byOrg);

  // Pull the user's projects across all orgs for the per-project drill-down.
  const projectRows = [];
  for (const o of orgs) {
    for (const p of projectsByOrg[o.slug] ?? []) {
      projectRows.push({ org: o, project: p });
    }
  }

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
            <p className="home-sample-note">
              <Info size={13} aria-hidden="true" />
              Sample data — live numbers arrive with the analytics backend (Phase 2).
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="secondary" size="md">
              <Zap size={14} aria-hidden="true" /> Go to My work
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid-4 home-kpis">
        {KPI_TILES.map(({ label, value, delta, tone, icon: Icon }) => (
          <div key={label} className="stat">
            <div className="home-kpi-head">
              <span className={`home-icon-badge is-${tone}`}>
                <Icon size={15} aria-hidden="true" />
              </span>
              <span className="home-kpi-label">{label}</span>
            </div>
            <div className="stat-row">
              <div className="stat-value">{value}</div>
              <span className={`stat-delta home-delta is-${tone}`}>{delta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-12">
        <div className="card home-card col-8">
          <div className="between home-card-head">
            <div>
              <h2 className="h-card">Weekly throughput</h2>
              <p className="muted home-card-sub">Tasks completed per week</p>
            </div>
            <span className="stat-delta stat-delta-up">+18%</span>
          </div>
          <Sparkline
            points={PLACEHOLDER_TREND}
            width={520}
            height={120}
            stroke="var(--accent)"
            className="home-trend"
          />
        </div>

        <div className="card-ai home-insight col-4">
          <AIChip label="Weekly insight" variant="soft" />
          <div className="home-insight-title">
            You shipped 18% more than last month — and reviewers are noticing.
          </div>
          <p className="muted home-insight-body">
            Tasks in In Review average 1.4 days, well under the team's 2-day target.
            Spend the breathing room knocking down two high-priority items in Backlog.
          </p>
          <Button variant="ghost" size="sm" disabled title="Phase 2">
            See full report <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </div>

        <div className="card home-card col-12">
          <h2 className="h-card home-card-head">Per project</h2>
          {projectRows.length === 0 ? (
            <p className="muted home-placeholder">
              You're not in any projects yet — create or join one to see per-project performance.
            </p>
          ) : (
            <ul className="home-project-list">
              {projectRows.map(({ org, project }) => {
                const meta = findProjectType(project.type);
                const tint = (meta?.id ?? 'generic').toLowerCase();
                return (
                  <li key={project.id}>
                    <Link
                      to={`/${org.slug}/projects/${project.slug}/dashboard`}
                      className="home-project-row"
                    >
                      <span className={`proj-icon proj-icon-${tint}`} aria-hidden="true">
                        {project.name?.[0]?.toUpperCase() ?? '·'}
                      </span>
                      <span className="home-project-meta">
                        <span className="home-project-name truncate">{project.name}</span>
                        <span className="mono muted home-project-key">{project.key ?? '··'}</span>
                      </span>
                      <span className="muted home-project-stats">12 tasks · 38 pt</span>
                      <span className="status status-done">On track</span>
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
