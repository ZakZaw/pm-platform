import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Camera,
  Folder,
  Info,
  Pencil,
  Plus,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Avatar, AvatarStack, Badge, Button, Card, Skeleton, Sparkline, useToast } from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import { projectsApi } from '@/api/projects.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import { useOrgStore } from '@/store/orgStore';
import './OrgHomePage.css';

// Placeholder velocity series until org-level analytics ship (Phase 2).
const PLACEHOLDER_VELOCITY = [22, 28, 31, 27, 34, 32, 38, 41];

const PLACEHOLDER_ACTIVITY = [
  { who: 'Marcus Chen', color: 2, action: 'closed', target: 'Sprint 23', time: '12m' },
  { who: 'Priya Patel', color: 1, action: 'created', target: 'ATL-301', time: '36m' },
  { who: 'Sasha Volkov', color: 3, action: 'invited', target: 'aria@…', time: '1h' },
  { who: 'Diego Ortiz', color: 4, action: 'merged', target: 'PR #482', time: '2h' },
  { who: 'Stratos AI', color: 5, action: 'drafted plan for', target: 'EPIC-Onboarding', time: '3h', ai: true },
];

const ROLE_TONE = {
  Owner: 'purple',
  Admin: 'info',
  Member: 'neutral',
  Guest: 'neutral',
};

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
        if (!cancelled) {
          setError(err.response?.data?.detail ?? 'Could not load organization.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'Active').length,
    [projects],
  );

  async function commitName() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!org || next === org.name) return;
    if (next.length < 2 || next.length > 80) {
      toast.show({ tone: 'danger', message: 'Name must be 2–80 characters.' });
      return;
    }
    try {
      const updated = await orgsApi.update(slug, { name: next });
      setOrg(updated);
      refreshOrgs().catch(() => {});
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not rename organization.',
      });
    }
  }

  async function onLogoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-uploading the same filename
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      toast.show({ tone: 'danger', message: 'Logo must be PNG, JPEG, or WebP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.show({ tone: 'danger', message: 'Logo must be 2 MB or smaller.' });
      return;
    }
    setUploadingLogo(true);
    try {
      const updated = await orgsApi.uploadLogo(slug, file);
      setOrg(updated);
      refreshOrgs().catch(() => {});
      toast.show({ tone: 'success', message: 'Logo updated.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not upload logo.',
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  if (error) return <p className="org-home__placeholder">{error}</p>;
  if (!org) {
    return (
      <div className="page org-home" aria-busy="true">
        <Skeleton width={220} height={24} />
        <div style={{ height: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton width="60%" height={12} />
              <div style={{ height: 12 }} />
              <Skeleton width="40%" height={22} />
            </Card>
          ))}
        </div>
        <div style={{ height: 16 }} />
        <Card>
          <Skeleton rows={4} />
        </Card>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Projects',
      value: projects.length,
      sub: `${activeProjects} active`,
      icon: Folder,
      tone: 'info',
      placeholder: false,
    },
    {
      label: 'Members',
      value: memberSummary.total,
      sub: 'across the org',
      icon: Users,
      tone: 'success',
      placeholder: false,
    },
    {
      label: 'Active sprints',
      value: '—',
      sub: 'across all projects',
      icon: Rocket,
      tone: 'purple',
      placeholder: true,
    },
    {
      label: 'Done · 30d',
      value: '—',
      sub: 'task velocity',
      icon: TrendingUp,
      tone: 'warning',
      placeholder: true,
    },
  ];

  return (
    <div className="page org-home">
      <header className="org-home__header">
        <label
          className={[
            'org-home__logo',
            isAdminOrAbove ? 'is-editable' : '',
            uploadingLogo ? 'is-busy' : '',
          ].filter(Boolean).join(' ')}
          title={isAdminOrAbove ? 'Click to upload a new logo' : undefined}
        >
          <Avatar src={org.logoUrl} name={org.name} size="xl" />
          {isAdminOrAbove && (
            <>
              <span className="org-home__logo-overlay" aria-hidden="true">
                <Camera size={16} />
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onLogoChange}
                className="org-home__logo-input"
                aria-label="Upload organization logo"
                disabled={uploadingLogo}
              />
            </>
          )}
        </label>
        <div className="grow">
          <div className="hstack" style={{ gap: 8, alignItems: 'center' }}>
            {editingName ? (
              <input
                className="org-home__title-input"
                value={nameDraft}
                autoFocus
                maxLength={80}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitName();
                  } else if (e.key === 'Escape') {
                    setNameDraft(org.name);
                    setEditingName(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className={[
                  'org-home__title',
                  isAdminOrAbove ? 'is-editable' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  if (!isAdminOrAbove) return;
                  setNameDraft(org.name);
                  setEditingName(true);
                }}
                title={isAdminOrAbove ? 'Click to rename' : undefined}
              >
                {org.name}
                {isAdminOrAbove && <Pencil size={12} className="org-home__title-icon" aria-hidden="true" />}
              </button>
            )}
            <Badge tone={ROLE_TONE[org.role] ?? 'neutral'}>{org.role}</Badge>
          </div>
          <div className="org-home__slug">/{org.slug}</div>
        </div>
        <Link to={`/${slug}/projects/new`}>
          <Button size="sm">
            <Plus size={14} aria-hidden="true" /> New project
          </Button>
        </Link>
      </header>

      <div className="org-home__note">
        <Info size={12} aria-hidden="true" />
        <span>
          Sprint counts, velocity, and activity feed use sample data until org-level analytics ship (Phase 2).
        </span>
      </div>

      <div className="org-home__kpis">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="org-home__kpi">
              <div className="hstack org-home__kpi-head">
                <span
                  className="org-home__kpi-icon"
                  style={{
                    background: `var(--status-${k.tone}-bg)`,
                    color: `var(--status-${k.tone})`,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={14} />
                </span>
                <span className="org-home__kpi-label">
                  {k.label}
                  {k.placeholder && <span className="org-home__sample"> · sample</span>}
                </span>
              </div>
              <div className="org-home__kpi-value">{k.value}</div>
              <div className="org-home__kpi-sub">{k.sub}</div>
            </Card>
          );
        })}
      </div>

      <div className="org-home__grid">
        <section className="org-home__col-wide">
          <div className="org-home__section-head">
            <h2 className="org-home__section-title">
              <Briefcase size={14} aria-hidden="true" /> Projects
            </h2>
            <span className="org-home__count">{projects.length}</span>
          </div>

          {projects.length === 0 ? (
            <Card className="org-home__empty">
              <Briefcase size={32} aria-hidden="true" />
              <p>No projects yet. Create your first one to start planning work.</p>
              <Link to={`/${slug}/projects/new`}>
                <Button>Create project</Button>
              </Link>
            </Card>
          ) : (
            <div className="org-home__project-grid">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/${slug}/projects/${p.slug}`}
                  className="org-home__project-card"
                >
                  <div className="org-home__project-name">{p.name}</div>
                  <div className="org-home__project-meta">
                    <Badge tone="neutral">{p.type}</Badge>
                    <Badge tone={p.status === 'Active' ? 'success' : 'neutral'}>{p.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="org-home__section-head" style={{ marginTop: 24 }}>
            <h2 className="org-home__section-title">
              <Activity size={14} aria-hidden="true" /> Recent activity
              <span className="org-home__sample"> · sample</span>
            </h2>
          </div>
          <Card>
            <ul className="org-home__activity">
              {PLACEHOLDER_ACTIVITY.map((a, i) => (
                <li key={i} className="org-home__activity-row">
                  {a.ai ? (
                    <span className="org-home__ai-mark" aria-hidden="true">
                      <Sparkles size={12} color="#fff" />
                    </span>
                  ) : (
                    <Avatar name={a.who} color={a.color} size="xs" />
                  )}
                  <span className="org-home__activity-text">
                    <span className="org-home__activity-who">{a.who}</span>{' '}
                    <span className="muted">{a.action}</span>{' '}
                    <span className="mono org-home__activity-target">{a.target}</span>
                  </span>
                  <span className="mono dim org-home__activity-time">{a.time}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="org-home__col-narrow">
          <div className="org-home__section-head">
            <h2 className="org-home__section-title">
              <Users size={14} aria-hidden="true" /> Members
            </h2>
            <Link
              to={`/${slug}/settings/members`}
              className="org-home__section-link"
            >
              Manage
            </Link>
          </div>

          <Card>
            {memberSummary.items.length === 0 ? (
              <p className="org-home__placeholder" style={{ padding: 0 }}>
                No members loaded.
              </p>
            ) : (
              <>
                <AvatarStack
                  people={memberSummary.items.map((m) => ({
                    name: m.fullName,
                    avatarUrl: m.avatarUrl,
                  }))}
                  max={6}
                  size="sm"
                />
                <ul className="org-home__member-list">
                  {memberSummary.items.slice(0, 5).map((m) => (
                    <li key={m.userId} className="org-home__member-row">
                      <Avatar name={m.fullName} src={m.avatarUrl} size="xs" />
                      <span className="truncate">{m.fullName}</span>
                      <Badge tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <div className="org-home__section-head" style={{ marginTop: 16 }}>
            <h2 className="org-home__section-title">
              <TrendingUp size={14} aria-hidden="true" /> Velocity
              <span className="org-home__sample"> · sample</span>
            </h2>
          </div>
          <Card>
            <div className="org-home__sparkwrap">
              <Sparkline
                points={PLACEHOLDER_VELOCITY}
                width={260}
                height={56}
                stroke="var(--accent)"
              />
            </div>
            <div className="org-home__spark-meta">
              <span className="mono">{PLACEHOLDER_VELOCITY.at(-1)}</span>
              <span className="muted"> pts last sprint · trend up</span>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
