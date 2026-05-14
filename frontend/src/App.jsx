import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { CreateOrgPage } from '@/pages/onboarding/CreateOrgPage';
import { OrgHomePage } from '@/pages/org/OrgHomePage';
import { MembersPage } from '@/pages/settings/MembersPage';
import { ProfilePage } from '@/pages/settings/ProfilePage';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';

function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <AppShell />;
}

// Forces OrgHomePage to remount when slug changes so its useState resets cleanly.
function OrgHomePageKeyed() {
  const { slug } = useParams();
  return <OrgHomePage key={slug} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invitations/:token" element={<AcceptInvitePage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding/create-org" element={<CreateOrgPage />} />
          <Route path="/:slug/home" element={<OrgHomePageKeyed />} />
          <Route path="/:slug/settings/members" element={<MembersPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
