import { useAuthStore } from '@/store/authStore';
import './DashboardPage.css';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="dashboard__title">Welcome, {user?.fullName}</h1>
      <p className="dashboard__subtitle">
        You are signed in as {user?.email}. The real dashboard arrives in F2-04.
      </p>
    </div>
  );
}
