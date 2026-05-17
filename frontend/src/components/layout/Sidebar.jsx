import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Home,
  KanbanSquare,
  Layers,
  Plus,
  Rocket,
  Settings,
  Users,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import './Sidebar.css';

export function Sidebar() {
  const location = useLocation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const orgs = useOrgStore((s) => s.orgs);
  const orgsLoaded = useOrgStore((s) => s.loaded);
  const refreshOrgs = useOrgStore((s) => s.refresh);
  const projectsByOrg = useProjectStore((s) => s.byOrg);
  const projectsLoadedByOrg = useProjectStore((s) => s.loadedByOrg);
  const refreshProjects = useProjectStore((s) => s.refreshForOrg);
  const lastOrgSlug = useUiStore((s) => s.lastOrgSlug);
  const setLastOrgSlug = useUiStore((s) => s.setLastOrgSlug);

  // orgStore isn't persisted, so on a hard reload it's empty until we
  // refresh. The Sidebar is the right place for this because it's the only
  // always-mounted consumer of the org list inside the protected shell.
  useEffect(() => {
    if (!orgsLoaded) {
      refreshOrgs().catch(() => {});
    }
  }, [orgsLoaded, refreshOrgs]);

  // useParams() inside a layout returns the parent Route's params, not the
  // matched child's, so we read the slug from the URL directly and verify
  // it against the loaded org list. Segments like "dashboard", "onboarding",
  // "settings", "invitations" won't match any org slug.
  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  const urlOrg = orgs.find((o) => o.slug === firstSegment) ?? null;

  // Remember the last org the user was actually inside so user-scoped
  // pages (/dashboard, /settings/profile) can keep showing the org nav.
  useEffect(() => {
    if (urlOrg && urlOrg.slug !== lastOrgSlug) {
      setLastOrgSlug(urlOrg.slug);
    }
  }, [urlOrg, lastOrgSlug, setLastOrgSlug]);

  // Every user has at least one org, so we always have something to show:
  // URL org → last visited → first org in the list.
  const currentOrg =
    urlOrg ?? orgs.find((o) => o.slug === lastOrgSlug) ?? orgs[0] ?? null;
  const slug = currentOrg?.slug ?? null;

  // Pull the project slug from /:slug/projects/:projectSlug/... so the
  // sidebar can show project-scoped nav (Epics, Stories, etc.) without
  // every page having to manage the sidebar state itself.
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const projectSlug =
    pathSegments[0] === slug && pathSegments[1] === 'projects' && pathSegments[2] && pathSegments[2] !== 'new'
      ? pathSegments[2]
      : null;

  // Lazy-load the project list for the current org so it shows in the
  // sidebar regardless of which page the user is on.
  useEffect(() => {
    if (slug && !projectsLoadedByOrg[slug]) {
      refreshProjects(slug).catch(() => {});
    }
  }, [slug, projectsLoadedByOrg, refreshProjects]);

  const projects = slug ? projectsByOrg[slug] ?? [] : [];

  const sidebarClasses = ['sidebar', collapsed ? 'sidebar--collapsed' : '']
    .filter(Boolean)
    .join(' ');

  const linkClass = ({ isActive }) =>
    ['sidebar__link', isActive ? 'sidebar__link--active' : '']
      .filter(Boolean)
      .join(' ');

  return (
    <aside className={sidebarClasses} aria-label="Primary navigation">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true" />
        {!collapsed && <span className="sidebar__brand-text">PM Platform</span>}
      </div>

      {currentOrg && !collapsed && (
        <NavLink
          to={`/${currentOrg.slug}/home`}
          className="sidebar__org"
          title={currentOrg.name}
        >
          <Avatar src={currentOrg.logoUrl} name={currentOrg.name} size="md" />
          <div className="sidebar__org-info">
            <div className="sidebar__org-name">{currentOrg.name}</div>
            <div className="sidebar__org-role">{currentOrg.role}</div>
          </div>
        </NavLink>
      )}

      <nav className="sidebar__nav">
        <NavLink to="/dashboard" className={linkClass} title={collapsed ? 'My work' : undefined}>
          <CheckSquare className="sidebar__link-icon" aria-hidden="true" />
          {!collapsed && <span className="sidebar__link-label">My work</span>}
        </NavLink>

        {slug && (
          <>
            {!collapsed && <div className="sidebar__section">Workspace</div>}
            <NavLink to={`/${slug}/home`} className={linkClass} end title={collapsed ? 'Home' : undefined}>
              <Home className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">Home</span>}
            </NavLink>
            <NavLink to={`/${slug}/settings/members`} className={linkClass} title={collapsed ? 'Members' : undefined}>
              <Users className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">Members</span>}
            </NavLink>
          </>
        )}

        {slug && (
          <>
            {!collapsed && <div className="sidebar__section">Projects</div>}
            {projects.length === 0 && !collapsed && (
              <div className="sidebar__empty">No projects yet</div>
            )}
            {projects.map((p) => {
              const isCurrent = p.slug === projectSlug;
              return (
                <div key={p.id} className="sidebar__project">
                  <NavLink
                    to={`/${slug}/projects/${p.slug}`}
                    className={linkClass}
                    end
                    title={collapsed ? p.name : undefined}
                  >
                    <Briefcase className="sidebar__link-icon" aria-hidden="true" />
                    {!collapsed && <span className="sidebar__link-label">{p.name}</span>}
                  </NavLink>
                  {isCurrent && !collapsed && (
                    <div className="sidebar__sub">
                      <NavLink to={`/${slug}/projects/${p.slug}/epics`} className={linkClass}>
                        <Layers className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Epics</span>
                      </NavLink>
                      <NavLink to={`/${slug}/projects/${p.slug}/board`} className={linkClass}>
                        <KanbanSquare className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Board</span>
                      </NavLink>
                      <NavLink to={`/${slug}/projects/${p.slug}/backlog`} className={linkClass}>
                        <ClipboardList className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Backlog</span>
                      </NavLink>
                      <NavLink to={`/${slug}/projects/${p.slug}/sprints`} className={linkClass}>
                        <Rocket className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Sprints</span>
                      </NavLink>
                      <NavLink to={`/${slug}/projects/${p.slug}/settings/members`} className={linkClass}>
                        <Users className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Members</span>
                      </NavLink>
                      <NavLink to={`/${slug}/projects/${p.slug}/settings/workflow`} className={linkClass}>
                        <Settings className="sidebar__link-icon" aria-hidden="true" />
                        <span className="sidebar__link-label">Workflow</span>
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            })}
            <NavLink
              to={`/${slug}/projects/new`}
              className={linkClass}
              title={collapsed ? 'New project' : undefined}
            >
              <Plus className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">New project</span>}
            </NavLink>
          </>
        )}

      </nav>

      <div className="sidebar__footer">
        <Button
          variant="ghost"
          size="sm"
          block
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={16} aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
