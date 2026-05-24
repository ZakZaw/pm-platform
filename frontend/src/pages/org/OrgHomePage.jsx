import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  Briefcase,
  Calendar,
  Camera,
  Filter,
  Pencil,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  AIChip,
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Segmented,
  Skeleton,
  Sparkline,
  useToast,
} from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import { projectsApi } from '@/api/projects.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import { useOrgStore } from '@/store/orgStore';
import { findProjectType, PROJECT_TYPES } from '@/constants/projectTypes';
import './OrgHomePage.css';

const PLACEHOLDER_VELOCITY = [22, 24, 26, 25, 28, 30, 28, 32, 30, 33, 34];
const PLACEHOLDER_PIPELINE = [800, 820, 810, 900, 950, 1000, 1050, 1100, 1150, 1180, 1260];
const PLACEHOLDER_TICKETS = [40, 38, 36, 35, 32, 30, 32, 30, 28, 29, 28];

const TYPE_TONE = {
  Engineering: 'accent',
  Sales: 'success',
  Support: 'rose',
  Marketing: 'warning',
  Operations: 'violet',
  Generic: 'neutral',
};

const ROLE_TONE = {
  Owner: 'violet',
  Admin: 'info',
  Member: 'neutral',
  Guest: 'neutral',
};

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
  const { isAdminOrAbove } = useOrgRole(slug);
  const refreshOrgs = useOrgStore((s) => s.refresh);
  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [memberSummary, setMemberSummary] = useState({ items: [], total: 0 });
  const [error, setError] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [orgData, projectList, members] = await Promise.all([
          orgsApi.get(slug),
          projectsApi.listForOrg(slug),
          orgsApi.listMembers(slug, { page: 1, pageSize: 6 }).catch(() => ({ items: [], total: 0 })),
        ]);
        if (cancelled) return;
        setOrg(orgData);
        setProjects(projectList);
        setMemberSummary(members);
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
      <div className="main-inner" aria-busy="true">
        <Skeleton width="40%" height={28} />
        <div style={{ height: 20 }} />
        <div className="grid-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={92} radius="lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="main-inner org-home">
      <div className="page-head">
        <div className="page-title-row">
          <div className="row gap-5">
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
              <div className="eyebrow" style={{ marginBottom: 6 }}>Workspace</div>
              <div className="row gap-3" style={{ alignItems: 'center' }}>
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
                <Badge tone={ROLE_TONE[org.role] ?? 'neutral'}>{org.role}</Badge>
              </div>
              <p className="page-subtitle" style={{ marginTop: 8 }}>
                {projects.length} project{projects.length === 1 ? '' : 's'} ({activeProjects} active) · {memberSummary.total} member{memberSummary.total === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="row gap-3">
            <Button size="sm" disabled title="Coming in Phase 2">
              <Filter size={13} aria-hidden="true" /> Filter
            </Button>
            <Link to={`/${slug}/projects/new`}>
              <Button variant="ai" size="sm">
                <Sparkles size={13} aria-hidden="true" /> New project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--s-9)' }}>
        <div className="stat">
          <div className="stat-label">Portfolio health<span className="org-home-sample">sample</span></div>
          <div className="stat-row">
            <div className="stat-value">82</div>
            <HealthRing value={82} size={32} />
          </div>
          <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>across {projects.length} projects · daily snapshot</div>
        </div>
        <div className="stat">
          <div className="stat-label">Velocity<span className="org-home-sample">sample</span></div>
          <div className="stat-row">
            <div className="stat-value">34<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}> pts/wk</span></div>
            <span className="stat-delta stat-delta-up"><ArrowUp size={10} strokeWidth={3} />8%</span>
          </div>
          <Sparkline points={PLACEHOLDER_VELOCITY} stroke="var(--accent)" />
        </div>
        <div className="stat">
          <div className="stat-label">Pipeline value<span className="org-home-sample">sample</span></div>
          <div className="stat-row">
            <div className="stat-value mono">$1.26m</div>
            <span className="stat-delta stat-delta-up"><ArrowUp size={10} strokeWidth={3} />12%</span>
          </div>
          <Sparkline points={PLACEHOLDER_PIPELINE} stroke="var(--success)" />
        </div>
        <div className="stat">
          <div className="stat-label">Open tickets · SLA<span className="org-home-sample">sample</span></div>
          <div className="stat-row">
            <div className="stat-value">28<span style={{ fontSize: 'var(--fs-md)', color: 'var(--text-muted)', fontWeight: 500 }}> open</span></div>
            <span className="stat-delta stat-delta-up">94%</span>
          </div>
          <Sparkline points={PLACEHOLDER_TICKETS} stroke="var(--violet)" />
        </div>
      </div>

      {/* AI suggestions ribbon */}
      <div className="ai-card" style={{ marginBottom: 'var(--s-9)' }}>
        <div className="ai-card-head">
          <div className="ai-mark"><Sparkles size={14} /></div>
          <div className="col" style={{ gap: 2, flex: 1 }}>
            <strong style={{ fontSize: 'var(--fs-md)' }}>
              AI suggestions waiting for your call
            </strong>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
              Open the AI inbox in any project to review.
            </span>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="between" style={{ marginBottom: 'var(--s-6)' }}>
        <h2 className="h-card" style={{ fontSize: 'var(--fs-lg)' }}>Projects</h2>
        <Segmented value={filter} onChange={setFilter} options={typeFilters} />
      </div>

      <div className="org-home-project-grid">
        {filteredProjects.length === 0 ? (
          <div className="card org-home-empty">
            <Briefcase size={32} aria-hidden="true" />
            <p>No projects in this filter.</p>
            <Link to={`/${slug}/projects/new`}>
              <Button>Create project</Button>
            </Link>
          </div>
        ) : (
          filteredProjects.map((p) => {
            const meta = findProjectType(p.type);
            const accent = (meta?.id ?? 'generic').toLowerCase();
            const tone = TYPE_TONE[meta?.id] ?? 'neutral';
            return (
              <Link key={p.id} to={`/${slug}/projects/${p.slug}`} className="card card-hover org-home-project-card">
                <div className="row gap-4" style={{ marginBottom: 'var(--s-5)' }}>
                  <div className={`proj-icon proj-icon-${accent}`} style={{ width: 36, height: 36, fontSize: 'var(--fs-md)' }}>
                    {meta?.short?.[0] ?? '·'}
                  </div>
                  <div className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                    <div className="row between gap-3">
                      <Badge tone={tone}>
                        <span className="badge-dot" />
                        {meta?.label}
                      </Badge>
                      <AIChip label="Suggest" />
                    </div>
                  </div>
                </div>
                <div className="h-card" style={{ marginBottom: 'var(--s-3)', lineHeight: 1.25 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginBottom: 'var(--s-5)' }}>
                  /{p.slug}
                </div>
                <div className="row between" style={{ marginTop: 'auto' }}>
                  <Badge tone={p.status === 'Active' ? 'success' : 'neutral'}>{p.status}</Badge>
                  <div className="row gap-3 muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    <Calendar size={12} />
                    <span>{p.due ?? '—'}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}

        {/* New project tile */}
        <Link to={`/${slug}/projects/new`} className="card card-hover org-home-new-tile">
          <div className="ai-mark" style={{ width: 36, height: 36, borderRadius: 'var(--r-md)' }}>
            <Plus size={18} strokeWidth={2.4} />
          </div>
          <div className="h-card">Start a new project</div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)', textAlign: 'center', padding: '0 var(--s-7)' }}>
            Describe what you want to ship. AI will pick the right type and scaffold the work.
          </div>
        </Link>
      </div>

      {/* Members rail */}
      <div className="org-home-members">
        <div className="row between" style={{ marginBottom: 'var(--s-4)' }}>
          <h3 className="h-card">Members</h3>
          <Link to={`/${slug}/settings/members`} className="muted org-home-members-link">
            Manage <ArrowRight size={10} />
          </Link>
        </div>
        <div className="card" style={{ padding: 'var(--s-6) var(--s-7)' }}>
          {memberSummary.items.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>No members loaded.</p>
          ) : (
            <div className="row gap-4">
              <AvatarStack
                people={memberSummary.items.map((m) => ({ name: m.fullName, avatarUrl: m.avatarUrl }))}
                max={8}
                size="sm"
              />
              <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                {memberSummary.total} total
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
