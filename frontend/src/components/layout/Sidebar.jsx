import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  ChevronsUpDown,
  ClipboardList,
  FolderKanban,
  Home,
  Layers,
  LayoutGrid,
  Plus,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import './Sidebar.css';

// Maps a project to one of the eight Stratos avatar gradient slots so
// the swatch alongside the project name stays stable for that project.
function projectSwatch(name) {
  if (!name) return 'av-1';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `av-${(hash % 8) + 1}`;
}

export function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const orgs = useOrgStore((s) => s.orgs);
  const orgsLoaded = useOrgStore((s) => s.loaded);
  const refreshOrgs = useOrgStore((s) => s.refresh);
  const projectsByOrg = useProjectStore((s) => s.byOrg);
  const projectsLoadedByOrg = useProjectStore((s) => s.loadedByOrg);
  const refreshProjects = useProjectStore((s) => s.refreshForOrg);
  const lastOrgSlug = useUiStore((s) => s.lastOrgSlug);
  const setLastOrgSlug = useUiStore((s) => s.setLastOrgSlug);

  useEffect(() => {
    if (!orgsLoaded) refreshOrgs().catch(() => {});
  }, [orgsLoaded, refreshOrgs]);

  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  const urlOrg = orgs.find((o) => o.slug === firstSegment) ?? null;

  useEffect(() => {
    if (urlOrg && urlOrg.slug !== lastOrgSlug) setLastOrgSlug(urlOrg.slug);
  }, [urlOrg, lastOrgSlug, setLastOrgSlug]);

  const currentOrg = urlOrg ?? orgs.find((o) => o.slug === lastOrgSlug) ?? orgs[0] ?? null;
  const slug = currentOrg?.slug ?? null;

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const projectSlug =
    pathSegments[0] === slug &&
    pathSegments[1] === 'projects' &&
    pathSegments[2] &&
    pathSegments[2] !== 'new'
      ? pathSegments[2]
      : null;

  useEffect(() => {
    if (slug && !projectsLoadedByOrg[slug]) refreshProjects(slug).catch(() => {});
  }, [slug, projectsLoadedByOrg, refreshProjects]);

  const projects = slug ? projectsByOrg[slug] ?? [] : [];

  const sideClass = ({ isActive }) =>
    ['side-item', isActive ? 'is-active' : ''].filter(Boolean).join(' ');

  const orgMark = (currentOrg?.name?.[0] ?? '·').toUpperCase();

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      {currentOrg && (
        <NavLink to={`/${currentOrg.slug}/home`} className="org" title={currentOrg.name}>
          <div className="org-mark" aria-hidden="true">{orgMark}</div>
          <div className="grow">
            <div className="org-name">{currentOrg.name}</div>
            <div className="org-plan">{currentOrg.role}</div>
          </div>
          <ChevronsUpDown size={12} color="var(--text-muted)" aria-hidden="true" />
        </NavLink>
      )}

      <div className="side-section">Workspace</div>
      <NavLink to="/home" className={sideClass} title="Home">
        <Home size={13} aria-hidden="true" />
        <span className="side-item__label">Home</span>
      </NavLink>
      <NavLink to="/dashboard" className={sideClass} title="My work">
        <LayoutGrid size={13} aria-hidden="true" />
        <span className="side-item__label">My work</span>
      </NavLink>
      {slug && (
        <NavLink to={`/${slug}/home`} className={sideClass} end title="Organization">
          <Briefcase size={13} aria-hidden="true" />
          <span className="side-item__label">Organization</span>
        </NavLink>
      )}

      {slug && (
        <>
          <div className="side-section">
            <span>Projects</span>
            <NavLink
              to={`/${slug}/projects/new`}
              className="side-section__add"
              title="New project"
              aria-label="New project"
            >
              <Plus size={11} aria-hidden="true" />
            </NavLink>
          </div>
          {projects.length === 0 && (
            <div className="side-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
              <span className="side-item__label">No projects yet</span>
            </div>
          )}
          {projects.map((p) => (
            <div key={p.id} className="sidebar-project">
              <NavLink
                to={`/${slug}/projects/${p.slug}`}
                className={sideClass}
                end
                title={p.name}
              >
                <span className={['side-item__swatch', projectSwatch(p.name)].join(' ')} aria-hidden="true" />
                <span className="side-item__label truncate">{p.name}</span>
              </NavLink>
              {p.slug === projectSlug && (
                <div className="sidebar-project__sub">
                  <NavLink to={`/${slug}/projects/${p.slug}/epics`} className={sideClass}>
                    <Layers size={13} aria-hidden="true" />
                    <span className="side-item__label">Epics</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/board`} className={sideClass}>
                    <FolderKanban size={13} aria-hidden="true" />
                    <span className="side-item__label">Board</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/dashboard`} className={sideClass}>
                    <BarChart3 size={13} aria-hidden="true" />
                    <span className="side-item__label">Dashboard</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/backlog`} className={sideClass}>
                    <ClipboardList size={13} aria-hidden="true" />
                    <span className="side-item__label">Backlog</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/sprints`} className={sideClass}>
                    <Rocket size={13} aria-hidden="true" />
                    <span className="side-item__label">Sprints</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/settings/members`} className={sideClass}>
                    <Users size={13} aria-hidden="true" />
                    <span className="side-item__label">Members</span>
                  </NavLink>
                  <NavLink to={`/${slug}/projects/${p.slug}/settings/workflow`} className={sideClass}>
                    <Settings size={13} aria-hidden="true" />
                    <span className="side-item__label">Workflow</span>
                  </NavLink>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <div className="side-footer">
        <Avatar
          src={user?.avatarUrl}
          name={user?.fullName || user?.email}
          size="sm"
        />
        <div className="grow">
          <div className="side-footer__name">{user?.fullName ?? 'You'}</div>
          <div className="side-footer__email">{user?.email}</div>
        </div>
        <NavLink to="/settings/profile" className="icon-btn icon-btn-sm" title="Settings" aria-label="Settings">
          <Settings size={13} aria-hidden="true" />
        </NavLink>
      </div>
    </aside>
  );
}
