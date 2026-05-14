import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui';
import { useUiStore } from '@/store/uiStore';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  const sidebarClasses = ['sidebar', collapsed ? 'sidebar--collapsed' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={sidebarClasses} aria-label="Primary navigation">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden="true" />
        {!collapsed && <span className="sidebar__brand-text">PM Platform</span>}
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              ['sidebar__link', isActive ? 'sidebar__link--active' : '']
                .filter(Boolean)
                .join(' ')
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="sidebar__link-icon" aria-hidden="true" />
            {!collapsed && <span className="sidebar__link-label">{label}</span>}
          </NavLink>
        ))}
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
