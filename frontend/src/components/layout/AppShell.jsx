import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { QuickCreateTaskModal } from '@/components/tasks/QuickCreateTaskModal';
import { useUiStore } from '@/store/uiStore';
import './AppShell.css';

export function AppShell() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <div className={['app', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')}>
      <Sidebar />
      <Topbar />
      <main className="main">
        <Outlet />
      </main>
      <QuickCreateTaskModal />
    </div>
  );
}
