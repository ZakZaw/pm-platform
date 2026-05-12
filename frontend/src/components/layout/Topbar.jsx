import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import './Topbar.css';

function initialsFor(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="topbar">
      <div className="topbar__breadcrumb" />
      <div className="topbar__user">
        <span className="topbar__user-initials" aria-hidden="true">
          {initialsFor(user?.fullName)}
        </span>
        <span className="topbar__user-name">{user?.fullName}</span>
        <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </Button>
      </div>
    </header>
  );
}
