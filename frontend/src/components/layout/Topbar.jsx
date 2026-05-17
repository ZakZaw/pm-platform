import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Moon, Plus, Sun, UserCircle } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import './Topbar.css';

export function Topbar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const openQuickCreate = useUiStore((s) => s.openQuickCreate);
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

  return (
    <header className="topbar">
      <div className="topbar__breadcrumb" />
      <div className="topbar__user">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {isLight ? (
            <Moon size={16} aria-hidden="true" />
          ) : (
            <Sun size={16} aria-hidden="true" />
          )}
        </Button>
        <div className="topbar__user-menu" ref={menuRef}>
          <button
            type="button"
            className="topbar__user-trigger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Avatar
              src={user?.avatarUrl}
              name={user?.fullName || user?.email}
              size="sm"
            />
            <span className="topbar__user-name">{user?.fullName}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="topbar__menu" role="menu">
              <Link
                to="/settings/profile"
                className="topbar__menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <UserCircle size={14} aria-hidden="true" />
                <span>Profile</span>
              </Link>
              <button
                type="button"
                className="topbar__menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
