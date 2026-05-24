import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Clock,
  Flame,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { AIChip, Badge, Button, Card, Sparkline } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import './HomePage.css';

// Placeholder data only — the real backend endpoints land in Phase 2
// (F2-04 dashboard / F3-16 health-score / F3-18 weekly insight).
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
            <div className="eyebrow" style={{ marginBottom: 6 }}>Welcome back</div>
            <h1 className="page-title row gap-3">
              <BarChart3 size={18} aria-hidden="true" />
              {user?.fullName ? user.fullName.split(' ')[0] : 'there'}
              <Badge tone="neutral">Last 30d</Badge>
            </h1>
            <div className="page-subtitle">
              Your performance across every project. Sample data until the analytics
              backend lands (Phase 2).
            </div>
          </div>
          <div className="row gap-2">
            <Link to="/dashboard">
              <Button variant="secondary" size="md">
                <Zap size={14} aria-hidden="true" /> Go to My work
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="home-grid">
        {KPI_TILES.map(({ label, value, delta, tone, icon: Icon }) => (
          <div key={label} className="card home-kpi">
            <div className="row home-kpi-head">
              <span
                className="home-kpi-icon"
                style={{
                  background: `var(--status-${tone}-bg)`,
                  color: `var(--status-${tone})`,
                }}
              >
                <Icon size={13} aria-hidden="true" />
              </span>
              <span className="home-kpi-label">
                {label} <span className="home-sample">· sample</span>
              </span>
            </div>
            <div className="row home-kpi-body">
              <div className="home-kpi-value">{value}</div>
              <div className="mono home-kpi-delta" style={{ color: `var(--status-${tone})` }}>
                {delta}
              </div>
            </div>
          </div>
        ))}

        <div className="card home-chart-card">
          <div className="row home-widget-head">
            <div>
              <div className="home-widget-title">
                Weekly throughput <span className="home-sample">· sample</span>
              </div>
              <div className="muted home-widget-sub">Tasks completed per week</div>
            </div>
            <Badge tone="success">+18%</Badge>
          </div>
          <Sparkline
            points={PLACEHOLDER_TREND}
            width={520}
            height={120}
            stroke="var(--success)"
          />
        </div>

        <div className="card-ai home-insight">
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <AIChip label="Weekly insight" variant="soft" />
            <span className="muted" style={{ fontSize: 11 }}>· Sample insight</span>
          </div>
          <div className="home-insight-title">
            You shipped 18% more than last month — and reviewers are noticing.
          </div>
          <div className="muted home-insight-body">
            Tasks in In Review average 1.4 days, well under the team's 2-day target.
            Spend the breathing room knocking down two high-priority items in Backlog.
          </div>
          <Button variant="ai" size="sm" disabled title="Phase 2">
            See full report <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </div>

        <div className="card home-projects">
          <div className="home-widget-title" style={{ marginBottom: 10 }}>
            Per project
          </div>
          {projectRows.length === 0 ? (
            <p className="home-placeholder">
              You're not in any projects yet — create or join one to see per-project performance.
            </p>
          ) : (
            <ul className="home-project-list">
              {projectRows.map(({ org, project }) => (
                <li key={project.id}>
                  <Link
                    to={`/${org.slug}/projects/${project.slug}/dashboard`}
                    className="home-project-row"
                  >
                    <span className="home-project-meta">
                      <span className="mono muted home-project-key">{project.key ?? '··'}</span>
                      <span className="truncate">{project.name}</span>
                    </span>
                    <span className="home-project-stats">
                      <span className="mono muted">12 tasks · 38pt</span>
                      <Badge tone="success">on track</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="home-sample" style={{ marginTop: 6 }}>
            Per-project numbers are placeholders until F2-04 ships.
          </div>
        </div>
      </div>
    </div>
  );
}
