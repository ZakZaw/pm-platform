import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  Briefcase,
  Calendar,
  Camera,
  Filter,
  Info,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  Avatar,
  AvatarStack,
  Button,
  Segmented,
  Skeleton,
  Sparkline,
  useToast,
} from '@/components/ui';
import { aiApi } from '@/api/ai.api';
import { orgsApi } from '@/api/orgs.api';
import { projectsApi } from '@/api/projects.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import { useOrgStore } from '@/store/orgStore';
import { findProjectType, PROJECT_TYPES } from '@/constants/projectTypes';
import './OrgHomePage.css';

const PLACEHOLDER_VELOCITY = [22, 24, 26, 25, 28, 30, 28, 32, 30, 33, 34];
const PLACEHOLDER_PIPELINE = [800, 820, 810, 900, 950, 1000, 1050, 1100, 1150, 1180, 1260];
const PLACEHOLDER_TICKETS = [40, 38, 36, 35, 32, 30, 32, 30, 28, 29, 28];

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HealthRing({ value, size = 32 }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const dash = c * pct;
  const color = value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="org-home-health-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function OrgHomePage() {
  const { slug } = useParams();
  const toast = useToast();
  const { role: myRole, isAdminOrAbove } = useOrgRole(slug);
  const refreshOrgs = useOrgStore((s) => s.refresh);
  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [memberSummary, setMemberSummary] = useState({ items: [], total: 0 });
  const [error, setError] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [filter, setFilter] = useState('all');
  const [aiInbox, setAiInbox] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orgData, projectList, members, inbox] = await Promise.all([
          orgsApi.get(slug),
          projectsApi.listForOrg(slug),
          orgsApi.listMembers(slug, { page: 1, pageSize: 6 }).catch(() => ({ items: [], total: 0 })),
          aiApi.listOrgSuggestions(slug).catch(() => null),
        ]);
        if (cancelled) return;
        setOrg(orgData);
        setProjects(projectList);
        setMemberSummary(members);
        setAiInbox(inbox);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load organization.');
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'Active').length, [projects]);
  const projectTypes = useMemo(() => new Set(projects.map((p) => p.type).filter(Boolean)), [projects]);
  const filteredProjects = useMemo(
    () => (filter === 'all' ? projects : projects.filter((p) => p.type === filter)),
    [projects, filter],
  );

  const typeFilters = useMemo(() => {
    const opts = [{ value: 'all', label: `All · ${projects.length}` }];
    for (const t of PROJECT_TYPES) {
      if (projectTypes.has(t.id)) opts.push({ value: t.id, label: t.short });
    }
    return opts;
  }, [projects.length, projectTypes]);

  async function commitName() {
    const draft = nameDraft.trim();
    if (!draft || draft === org.name) {
      setEditingName(false);
      return;
    }
    try {
      const updated = await orgsApi.update(slug, { name: draft });
      setOrg(updated);
      await refreshOrgs().catch(() => {});
      toast.show({ tone: 'success', message: 'Organization renamed.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not rename organization.',
      });
    } finally {
      setEditingName(false);
    }
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const updated = await orgsApi.uploadLogo(slug, file);
      setOrg((cur) => ({ ...cur, ...updated }));
      await refreshOrgs().catch(() => {});
      toast.show({ tone: 'success', message: 'Logo updated.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not upload logo.',
      });
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  }

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!org) {
    return (
      <div className="main-inner org-home-loading" aria-busy="true">
        <Skeleton width="40%" height={28} />
        <div className="grid-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} radius="lg" />)}
        </div>
      </div>
    );
  }

  const role = org.role ?? myRole;
  const metaLine = [
    role,
    `${projects.length} project${projects.length === 1 ? '' : 's'} (${activeProjects} active)`,
    `${memberSummary.total} member${memberSummary.total === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="main-inner org-home">
      <div className="page-head">
        <div className="page-title-row">
          <div className="row gap-6">
            <label
              className={['org-home-logo', isAdminOrAbove ? 'is-editable' : '', uploadingLogo ? 'is-busy' : ''].filter(Boolean).join(' ')}
              title={isAdminOrAbove ? 'Click to upload a new logo' : undefined}
            >
              <Avatar src={org.logoUrl} name={org.name} size="xl" />
              {isAdminOrAbove && (
                <>
                  <span className="org-home-logo-overlay" aria-hidden="true">
                    <Camera size={16} />
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={onLogoChange}
                    className="org-home-logo-input"
                    aria-label="Upload organization logo"
                    disabled={uploadingLogo}
                  />
                </>
              )}
            </label>
            <div>
              <div className="eyebrow org-home-eyebrow">Workspace</div>
              {editingName ? (
                <input
                  className="org-home-title-input"
                  value={nameDraft}
                  autoFocus
                  maxLength={80}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitName(); }
                    else if (e.key === 'Escape') { setNameDraft(org.name); setEditingName(false); }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={['org-home-title', isAdminOrAbove ? 'is-editable' : ''].filter(Boolean).join(' ')}
                  onClick={() => { if (!isAdminOrAbove) return; setNameDraft(org.name); setEditingName(true); }}
                  title={isAdminOrAbove ? 'Click to rename' : undefined}
                >
                  <h1 className="page-title">{org.name}</h1>
                  {isAdminOrAbove && <Pencil size={14} className="org-home-title-icon" aria-hidden="true" />}
                </button>
              )}
              <p className="page-subtitle">{metaLine}</p>
            </div>
          </div>
          <div className="row gap-3">
            <Button variant="ghost" size="md" disabled title="Coming in Phase 2">
              <Filter size={14} aria-hidden="true" /> Filter
            </Button>
            <Link to={`/${slug}/projects/new`}>
              <Button variant="primary" size="md">
                <Sparkles size={14} aria-hidden="true" /> New project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI strip — placeholder figures until org analytics ship; flagged once, quietly. */}
      <section className="org-home-section" aria-label="At a glance">
        <p className="org-home-sample-note">
          <Info size={13} aria-hidden="true" />
          <span>
            Sample figures — org-wide trends are in progress.{' '}
            <Link to={`/${slug}/portfolio`} className="org-home-inline-link">
              Live project health is in Portfolio
            </Link>
            .
          </span>
        </p>
        <div className="grid-4">
          <div className="stat">
            <div className="stat-label">Portfolio health</div>
            <div className="stat-row">
              <div className="stat-value">82</div>
              <HealthRing value={82} size={32} />
            </div>
            <div className="org-home-stat-foot">across {projects.length} projects · daily snapshot</div>
          </div>
          <div className="stat">
            <div className="stat-label">Velocity</div>
            <div className="stat-row">
              <div className="stat-value">34<span className="org-home-unit">pts/wk</span></div>
              <span className="stat-delta stat-delta-up"><ArrowUp size={10} strokeWidth={3} />8%</span>
            </div>
            <Sparkline points={PLACEHOLDER_VELOCITY} stroke="var(--accent)" className="org-home-spark" />
          </div>
          <div className="stat">
            <div className="stat-label">Pipeline value</div>
            <div className="stat-row">
              <div className="stat-value">$1.26m</div>
              <span className="stat-delta stat-delta-up"><ArrowUp size={10} strokeWidth={3} />12%</span>
            </div>
            <Sparkline points={PLACEHOLDER_PIPELINE} stroke="var(--text-subtle)" className="org-home-spark" />
          </div>
          <div className="stat">
            <div className="stat-label">Open tickets</div>
            <div className="stat-row">
              <div className="stat-value">28<span className="org-home-unit">open</span></div>
              <span className="stat-delta stat-delta-up">94% SLA</span>
            </div>
            <Sparkline points={PLACEHOLDER_TICKETS} stroke="var(--text-subtle)" className="org-home-spark" />
          </div>
        </div>
      </section>

      {/* AI suggestions ribbon */}
      <div className="ai-card org-home-ai">
        <div className="ai-mark"><Sparkles size={14} /></div>
        <div className="col org-home-ai-text">
          <strong>
            {aiInbox?.total
              ? `${aiInbox.total} AI suggestion${aiInbox.total === 1 ? '' : 's'} waiting for your call`
              : 'No AI suggestions waiting right now'}
          </strong>
          <span className="muted">
            {aiInbox?.groups?.length
              ? aiInbox.groups.map((g) => `${g.count} ${findProjectType(g.projectType).short}`).join(' · ')
              : 'Insights from every project you can see collect in the org AI inbox.'}
          </span>
        </div>
        <Link to={`/${slug}/ai-inbox`}>
          <Button variant="ghost" size="sm">
            Open inbox <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </Link>
      </div>

      {/* Projects */}
      <section className="org-home-section">
        <div className="between org-home-section-head">
          <h2 className="h-card">Projects</h2>
          <Segmented value={filter} onChange={setFilter} options={typeFilters} ariaLabel="Filter projects by type" />
        </div>

        <div className="org-home-project-grid">
          {filteredProjects.length === 0 ? (
            <div className="card org-home-empty">
              <Briefcase size={32} aria-hidden="true" />
              <p>No projects in this filter.</p>
              <Link to={`/${slug}/projects/new`}>
                <Button variant="secondary">Create project</Button>
              </Link>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const meta = findProjectType(p.type);
              const tint = (meta?.id ?? 'generic').toLowerCase();
              const due = formatDate(p.targetDate ?? p.due);
              return (
                <Link key={p.id} to={`/${slug}/projects/${p.slug}`} className="card card-hover org-home-project-card">
                  <div className="row gap-4">
                    <div className={`proj-icon proj-icon-${tint}`} aria-hidden="true">
                      {meta?.short?.[0] ?? '·'}
                    </div>
                    <span className={`org-home-type is-${tint}`}>{meta?.label ?? p.type}</span>
                  </div>
                  <div className="org-home-project-name">{p.name}</div>
                  <div className="org-home-project-slug">/{p.slug}</div>
                  <div className="between org-home-project-foot">
                    <span className={`status ${p.status === 'Active' ? 'status-done' : 'status-todo'}`}>{p.status}</span>
                    <span className="row gap-4 org-home-project-meta">
                      {p.aiControlMode && (
                        <span className="row gap-2" title="AI control mode">
                          <Sparkles size={12} aria-hidden="true" />{p.aiControlMode}
                        </span>
                      )}
                      {due && (
                        <span className="row gap-2" title="Target date">
                          <Calendar size={12} aria-hidden="true" />{due}
                        </span>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })
          )}

          {/* New project tile */}
          <Link to={`/${slug}/projects/new`} className="org-home-new-tile">
            <span className="org-home-new-icon"><Plus size={18} strokeWidth={2.4} /></span>
            <div className="h-card">Start a new project</div>
            <div className="muted org-home-new-desc">
              Describe what you want to ship. AI will pick the right type and scaffold the work.
            </div>
          </Link>
        </div>
      </section>

      {/* Members */}
      <section className="card org-home-members">
        <div className="col gap-4">
          <h2 className="h-card">Members</h2>
          {memberSummary.items.length === 0 ? (
            <p className="muted org-home-members-empty">No members loaded.</p>
          ) : (
            <div className="row gap-4">
              <AvatarStack
                people={memberSummary.items.map((m) => ({ name: m.fullName, avatarUrl: m.avatarUrl }))}
                max={8}
                size="sm"
              />
              <span className="muted org-home-members-total">{memberSummary.total} total</span>
            </div>
          )}
        </div>
        <Link to={`/${slug}/settings/members`} className="org-home-members-link">
          Manage <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}