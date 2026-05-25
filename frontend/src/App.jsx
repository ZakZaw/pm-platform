import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AcceptInvitePage } from '@/pages/auth/AcceptInvitePage';
import { MyWorkPage } from '@/pages/dashboard/MyWorkPage';
import { HomePage } from '@/pages/home/HomePage';
import { CreateOrgPage } from '@/pages/onboarding/CreateOrgPage';
import { OrgHomePage } from '@/pages/org/OrgHomePage';
import { MembersPage } from '@/pages/settings/MembersPage';
import { ProfilePage } from '@/pages/settings/ProfilePage';
import { CreateProjectPage } from '@/pages/project/CreateProjectPage';
import { ProjectHomePage } from '@/pages/project/ProjectHomePage';
import { EpicsPage } from '@/pages/project/EpicsPage';
import { EpicDetailPage } from '@/pages/project/EpicDetailPage';
import { BoardPage } from '@/pages/project/BoardPage';
import { DashboardPage } from '@/pages/project/DashboardPage';
import { BacklogPage } from '@/pages/project/BacklogPage';
import { SprintsPage } from '@/pages/project/SprintsPage';
import { SprintBoardPage } from '@/pages/project/SprintBoardPage';
import { SprintDetailPage } from '@/pages/project/SprintDetailPage';
import { WorkflowSettingsPage } from '@/pages/project/WorkflowSettingsPage';
import { ProjectMembersPage } from '@/pages/project/ProjectMembersPage';
import { AIGenerationWizard } from '@/pages/project/AIGenerationWizard';
import { AIInboxPage } from '@/pages/project/AIInboxPage';
import { PipelinePage } from '@/pages/project/PipelinePage';
import { AccountsPage } from '@/pages/project/AccountsPage';
import { LeadsPage } from '@/pages/project/LeadsPage';
import { QueuePage } from '@/pages/project/QueuePage';
import { CustomersPage } from '@/pages/project/CustomersPage';
import { CampaignsPage } from '@/pages/project/CampaignsPage';
import { CalendarPage } from '@/pages/project/CalendarPage';
import { ListsPage } from '@/pages/project/ListsPage';
import { RunbooksPage } from '@/pages/project/RunbooksPage';
import { RunDetailPage } from '@/pages/project/RunDetailPage';
import { RoadmapPage } from '@/pages/project/RoadmapPage';
import { ProjectListPage } from '@/pages/project/ProjectListPage';
import { CustomFieldsPage } from '@/pages/project/CustomFieldsPage';
import { OrgPortfolioPage } from '@/pages/dashboard/OrgPortfolioPage';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <AppShell />;
}

// Forces a page to remount when its key changes so component-local state
// resets cleanly. Used for slug-keyed routes whose pages cache fetched data.
function Keyed({ children, paramKey }) {
  const params = useParams();
  return <div key={params[paramKey]}>{children}</div>;
}

function App() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invitations/:token" element={<AcceptInvitePage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/dashboard" element={<MyWorkPage />} />
            <Route path="/onboarding/create-org" element={<CreateOrgPage />} />
            <Route
              path="/:slug/home"
              element={<Keyed paramKey="slug"><OrgHomePage /></Keyed>}
            />
            <Route path="/:slug/settings/members" element={<MembersPage />} />
            <Route path="/:slug/projects/new" element={<CreateProjectPage />} />
            <Route path="/:slug/projects/new/ai" element={<AIGenerationWizard />} />
            <Route
              path="/:slug/projects/:projectSlug"
              element={<Keyed paramKey="projectSlug"><ProjectHomePage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/epics"
              element={<Keyed paramKey="projectSlug"><EpicsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/epics/:epicId"
              element={<Keyed paramKey="epicId"><EpicDetailPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/board"
              element={<Keyed paramKey="projectSlug"><BoardPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/dashboard"
              element={<Keyed paramKey="projectSlug"><DashboardPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/roadmap"
              element={<Keyed paramKey="projectSlug"><RoadmapPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/list"
              element={<Keyed paramKey="projectSlug"><ProjectListPage /></Keyed>}
            />
            <Route
              path="/:slug/portfolio"
              element={<Keyed paramKey="slug"><OrgPortfolioPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/backlog"
              element={<Keyed paramKey="projectSlug"><BacklogPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/sprints"
              element={<Keyed paramKey="projectSlug"><SprintsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/sprints/:sprintId"
              element={<Keyed paramKey="sprintId"><SprintDetailPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/sprints/:sprintId/board"
              element={<Keyed paramKey="sprintId"><SprintBoardPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/ai"
              element={<Keyed paramKey="projectSlug"><AIInboxPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/pipeline"
              element={<Keyed paramKey="projectSlug"><PipelinePage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/accounts"
              element={<Keyed paramKey="projectSlug"><AccountsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/leads"
              element={<Keyed paramKey="projectSlug"><LeadsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/queues"
              element={<Keyed paramKey="projectSlug"><QueuePage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/customers"
              element={<Keyed paramKey="projectSlug"><CustomersPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/campaigns"
              element={<Keyed paramKey="projectSlug"><CampaignsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/calendar"
              element={<Keyed paramKey="projectSlug"><CalendarPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/lists"
              element={<Keyed paramKey="projectSlug"><ListsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/runbooks"
              element={<Keyed paramKey="projectSlug"><RunbooksPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/runs/:runId"
              element={<Keyed paramKey="runId"><RunDetailPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/settings/workflow"
              element={<Keyed paramKey="projectSlug"><WorkflowSettingsPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/settings/members"
              element={<Keyed paramKey="projectSlug"><ProjectMembersPage /></Keyed>}
            />
            <Route
              path="/:slug/projects/:projectSlug/settings/fields"
              element={<Keyed paramKey="projectSlug"><CustomFieldsPage /></Keyed>}
            />
            <Route path="/settings/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
