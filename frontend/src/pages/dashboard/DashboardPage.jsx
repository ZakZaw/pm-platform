import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import './DashboardPage.css';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <main className="dashboard">
      <h1>Welcome, {user?.fullName}</h1>
      <p className="dashboard__subtitle">
        You are signed in as {user?.email}. The real dashboard arrives in F2-04.
      </p>
      <div className="dashboard__actions">
        <Button variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
