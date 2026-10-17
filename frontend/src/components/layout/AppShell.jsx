import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QuickCreateTaskModal } from '@/components/tasks/QuickCreateTaskModal';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { useUiStore } from '@/store/uiStore';
import './AppShell.css';

export function AppShell() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const navOpen = useUiStore((s) => s.mobileNavOpen);
  const closeNav = useUiStore((s) => s.closeMobileNav);
  const isPhone = useIsPhone();
  const { pathname } = useLocation();

  // On phones the sidebar is an off-canvas drawer: close it after navigating
  // and when the viewport grows back past the breakpoint.
  useEffect(() => { closeNav(); }, [pathname, isPhone, closeNav]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeNav(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, closeNav]);

  const className = [
    'app',
    collapsed && !isPhone ? 'is-collapsed' : '',
    navOpen && isPhone ? 'is-nav-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <Sidebar />
      {navOpen && isPhone && (
        <button type="button" className="app-scrim" aria-label="Close navigation" onClick={closeNav} />
      )}
      <Topbar />
      <main className="main">
        <Outlet />
      </main>
      <QuickCreateTaskModal />
    </div>
  );
}
