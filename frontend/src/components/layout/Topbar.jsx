import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  HelpCircle,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Sun,
  UserCircle,
} from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import './Topbar.css';

const SECTION_LABEL = {
  board: 'Board',
  backlog: 'Backlog',
  sprints: 'Sprints',
  epics: 'Epics',
  settings: 'Settings',
  members: 'Members',
  workflow: 'Workflow',
  new: 'New project',
  home: 'Home',
  dashboard: 'My work',
  profile: 'Profile',
  invitations: 'Invitations',
  onboarding: 'Onboarding',
};

function deriveCrumbs(pathname, orgs, projectsByOrg) {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return [];
  const [first, second, third, fourth, fifth] = segs;
  const org = orgs.find((o) => o.slug === first);
  if (!org) {
    // user-scoped pages like /dashboard, /settings/profile
    const label = SECTION_LABEL[first] ?? first.replace(/-/g, ' ');
    return [{ label, here: true }];
  }
  const crumbs = [
    { label: org.name, to: `/${org.slug}/home` },
  ];
  if (!second || second === 'home') {
    crumbs.push({ label: 'Home', here: true });
    return crumbs;
  }
  if (second === 'projects') {
    if (!third || third === 'new') {
      crumbs.push({ label: 'Projects', here: !third });
      if (third === 'new') crumbs.push({ label: 'New project', here: true });
      return crumbs;
    }
    crumbs.push({ label: 'Projects', to: `/${org.slug}/home` });
    const project = (projectsByOrg[org.slug] ?? []).find((p) => p.slug === third);
    crumbs.push({
      label: project?.name ?? third,
      to: `/${org.slug}/projects/${third}`,
      here: !fourth,
    });
    if (fourth) {
      const label =
        fourth === 'settings' && fifth
          ? `Settings · ${SECTION_LABEL[fifth] ?? fifth}`
          : SECTION_LABEL[fourth] ?? fourth;
      crumbs.push({ label, here: true });
    }
    return crumbs;
  }
  if (second === 'settings') {
    crumbs.push({ label: 'Settings', here: !third });
    if (third) crumbs.push({ label: SECTION_LABEL[third] ?? third, here: true });
    return crumbs;
  }
  crumbs.push({ label: SECTION_LABEL[second] ?? second, here: true });
  return crumbs;
}

export function Topbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const openQuickCreate = useUiStore((s) => s.openQuickCreate);

  const orgs = useOrgStore((s) => s.orgs);
  const projectsByOrg = useProjectStore((s) => s.byOrg);

  const isLight = theme === 'light';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const crumbs = useMemo(
    () => deriveCrumbs(location.pathname, orgs, projectsByOrg),
    [location.pathname, orgs, projectsByOrg],
  );

  return (
    <header className="app-topbar">
      <button
        type="button"
        className="icon-btn"
        onClick={toggleSidebar}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <PanelLeftOpen size={14} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={14} aria-hidden="true" />
        )}
      </button>

      <nav className="crumb" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="hstack" style={{ gap: 6 }}>
            {i > 0 && <span className="sep">/</span>}
            {c.here || !c.to ? (
              <span className="here">{c.label}</span>
            ) : (
              <Link to={c.to} className="crumb-link">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="topbar-spacer" />

      <div className="search-mini input-search" title="Search (coming soon)">
        <Search size={12} aria-hidden="true" />
        <input
          className="input"
          placeholder="Search or jump to…"
          aria-label="Search"
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="divider-y" />

      <div className="topbar-actions">
        <Button
          variant="primary"
          size="sm"
          onClick={() => openQuickCreate?.()}
          aria-label="Create task"
          title="Create a new task"
        >
          <Plus size={14} aria-hidden="true" />
          <span>New task</span>
        </Button>
        <button type="button" className="icon-btn" title="AI" aria-label="AI">
          <Sparkles size={14} color="var(--ai-violet)" aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" title="Notifications" aria-label="Notifications">
          <Bell size={14} aria-hidden="true" />
          <span className="indicator" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {isLight ? (
            <Moon size={14} aria-hidden="true" />
          ) : (
            <Sun size={14} aria-hidden="true" />
          )}
        </button>
        <button type="button" className="icon-btn" title="Help" aria-label="Help">
          <HelpCircle size={14} aria-hidden="true" />
        </button>
        <div className="topbar-user" ref={menuRef}>
          <button
            type="button"
            className="topbar-user__trigger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar src={user?.avatarUrl} name={user?.fullName || user?.email} size="sm" />
            <ChevronDown size={12} aria-hidden="true" color="var(--text-muted)" />
          </button>
          {menuOpen && (
            <div className="menu topbar-user__menu" role="menu">
              <Link
                to="/settings/profile"
                className="menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <UserCircle size={13} aria-hidden="true" />
                <span>Profile</span>
              </Link>
              <button
                type="button"
                className="menu-item is-danger"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={13} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
