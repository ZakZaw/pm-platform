import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Home,
  Layers,
  LayoutDashboard,
  ListTodo,
  Users,
  UserCircle,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useOrgStore } from '@/store/orgStore';
import { useUiStore } from '@/store/uiStore';
import './Sidebar.css';

export function Sidebar() {
  const location = useLocation();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const orgs = useOrgStore((s) => s.orgs);
  const orgsLoaded = useOrgStore((s) => s.loaded);
  const refreshOrgs = useOrgStore((s) => s.refresh);
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

        {projectSlug && (
          <>
            {!collapsed && <div className="sidebar__section">Project</div>}
            <NavLink
              to={`/${slug}/projects/${projectSlug}`}
              className={linkClass}
              end
              title={collapsed ? 'Overview' : undefined}
            >
              <Briefcase className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">Overview</span>}
            </NavLink>
            <NavLink
              to={`/${slug}/projects/${projectSlug}/epics`}
              className={linkClass}
              title={collapsed ? 'Epics' : undefined}
            >
              <Layers className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">Epics</span>}
            </NavLink>
            <NavLink
              to={`/${slug}/projects/${projectSlug}/stories`}
              className={linkClass}
              title={collapsed ? 'Stories' : undefined}
            >
              <ListTodo className="sidebar__link-icon" aria-hidden="true" />
              {!collapsed && <span className="sidebar__link-label">Stories</span>}
            </NavLink>
          </>
        )}

        {!collapsed && <div className="sidebar__section">You</div>}
        <NavLink to="/dashboard" className={linkClass} title={collapsed ? 'My work' : undefined}>
          <LayoutDashboard className="sidebar__link-icon" aria-hidden="true" />
          {!collapsed && <span className="sidebar__link-label">My work</span>}
        </NavLink>
        <NavLink to="/settings/profile" className={linkClass} title={collapsed ? 'Profile' : undefined}>
          <UserCircle className="sidebar__link-icon" aria-hidden="true" />
          {!collapsed && <span className="sidebar__link-label">Profile</span>}
        </NavLink>
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
