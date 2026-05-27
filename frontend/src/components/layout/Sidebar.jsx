import { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  FolderKanban,
  Home,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import { navItemsForType, DEFAULT_PROJECT_TYPE_ID } from '@/constants/projectTypes';
import './Sidebar.css';

function projectAccent(type) {
  const k = String(type ?? '').toLowerCase();
  if (k === 'engineering') return 'engineering';
  if (k === 'sales') return 'sales';
  if (k === 'support') return 'support';
  if (k === 'marketing') return 'marketing';
  if (k === 'operations') return 'operations';
  return 'generic';
}

function projectInitial(name) {
  return (name?.trim()?.[0] ?? '·').toUpperCase();
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const activeProject = projects.find((p) => p.slug === projectSlug) ?? null;
  const otherProjects = projects.filter((p) => p.slug !== projectSlug).slice(0, 4);

  const navCls = ({ isActive }) =>
    ['nav-item', isActive ? 'is-active' : ''].filter(Boolean).join(' ');

  const orgInitial = (currentOrg?.name?.[0] ?? '·').toUpperCase();

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      {currentOrg && (
        <button
          type="button"
          className="sidebar-org"
          onClick={() => navigate(`/${currentOrg.slug}/home`)}
          title={currentOrg.name}
        >
          <div className="sidebar-logo" aria-hidden="true"><span>{orgInitial}</span></div>
          <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
            <div className="sidebar-org-name truncate">{currentOrg.name}</div>
            <div className="sidebar-org-slug truncate">/{currentOrg.slug}</div>
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}

      <div className="sidebar-scroll">
        {slug && (
          <div className="sidebar-section">
            <button
              type="button"
              className="btn btn-ai btn-block"
              style={{ height: 36 }}
              onClick={() => navigate(`/${slug}/projects/new`)}
            >
              <Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />
              <span>New project with AI</span>
            </button>
          </div>
        )}

        <div className="sidebar-section">
          <div className="sidebar-label">Workspace</div>
          <NavLink to="/home" className={navCls} title="Home">
            <span className="nav-icon"><Home size={14} aria-hidden="true" /></span>
            <span>Home</span>
          </NavLink>
          <NavLink to="/dashboard" className={navCls} title="My work">
            <span className="nav-icon"><LayoutGrid size={14} aria-hidden="true" /></span>
            <span>My work</span>
          </NavLink>
          {slug && (
            <NavLink to={`/${slug}/home`} className={navCls} end title="Organization">
              <span className="nav-icon"><Home size={14} aria-hidden="true" /></span>
              <span>Organization</span>
            </NavLink>
          )}
          {slug && (
            <NavLink to={`/${slug}/portfolio`} className={navCls} title="Portfolio">
              <span className="nav-icon"><FolderKanban size={14} aria-hidden="true" /></span>
              <span>Portfolio</span>
            </NavLink>
          )}
          {slug && (
            <NavLink to={`/${slug}/chat`} className={navCls} title="Chat">
              <span className="nav-icon"><MessageSquare size={14} aria-hidden="true" /></span>
              <span>Chat</span>
            </NavLink>
          )}
        </div>

        {slug && activeProject && (
          <>
            <div className="sidebar-section">
              <div className="sidebar-label">
                <span>Active Project</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon-sm"
                  onClick={() => navigate(`/${slug}/home`)}
                  title="All projects"
                  aria-label="All projects"
                >
                  <Plus size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div
              className="proj-card"
              onClick={() => navigate(`/${slug}/projects/${activeProject.slug}`)}
            >
              <div className={`proj-icon proj-icon-${projectAccent(activeProject.type)}`}>
                {projectInitial(activeProject.name)}
              </div>
              <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
                <div className="proj-card-name truncate">{activeProject.name}</div>
                <div className="proj-card-type">{activeProject.type ?? 'Project'}</div>
              </div>
            </div>
            <div className="sidebar-section">
              {navItemsForType(activeProject.type ?? DEFAULT_PROJECT_TYPE_ID).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.key}
                    to={`/${slug}/projects/${activeProject.slug}/${item.path}`}
                    className={navCls}
                  >
                    <span className="nav-icon"><Icon size={14} aria-hidden="true" /></span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </>
        )}

        {slug && projects.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-label">
              <span>{activeProject ? 'Other Projects' : 'Projects'}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon-sm"
                onClick={() => navigate(`/${slug}/projects/new`)}
                title="New project"
                aria-label="New project"
              >
                <Plus size={12} aria-hidden="true" />
              </button>
            </div>
            {(activeProject ? otherProjects : projects).map((p) => (
              <NavLink
                key={p.id}
                to={`/${slug}/projects/${p.slug}`}
                className={navCls}
                end
                title={p.name}
              >
                <div
                  className={`proj-icon proj-icon-${projectAccent(p.type)}`}
                  style={{ width: 18, height: 18, fontSize: 9, borderRadius: 4 }}
                >
                  {projectInitial(p.name)}
                </div>
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
            {projects.length === 0 && (
              <div className="nav-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                <span>No projects yet</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-foot">
        <Avatar
          src={user?.avatarUrl}
          name={user?.fullName || user?.email}
          size="md"
        />
        <div className="col" style={{ gap: 1, flex: 1, minWidth: 0 }}>
          <div className="sidebar-foot-name truncate">{user?.fullName ?? 'You'}</div>
          <div className="sidebar-foot-mail truncate">{user?.email}</div>
        </div>
        <NavLink
          to="/settings/profile"
          className="btn btn-ghost btn-icon-sm"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={14} aria-hidden="true" />
        </NavLink>
      </div>
    </aside>
  );
}
