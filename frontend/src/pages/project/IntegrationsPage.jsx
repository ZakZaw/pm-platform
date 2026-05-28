import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  CircleCheck, CircleAlert, ExternalLink, GitBranch, Plug, Trash2,
} from 'lucide-react';
import { Badge, Button, Input, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { integrationsApi } from '@/api/integrations.api';
import './IntegrationsPage.css';

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * F2-23 — connect a project to a GitHub repo. Branches/PRs/CI that name
 * a task key ("AT-247") then drive that task's status + PR/CI badges.
 * Connect/disconnect is PM-only; everyone else sees the read-only list.
 */
export function IntegrationsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const location = useLocation();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [repo, setRepo] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const canEdit = project?.myRole === 'PM';

  const load = useCallback(async () => {
    const p = await projectsApi.getBySlug(orgSlug, projectSlug);
    setProject(p);
    const list = await integrationsApi.list(p.id);
    setIntegrations(list);
    return p;
  }, [orgSlug, projectSlug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch {
        /* surfaced via empty state below */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  // Surface the OAuth callback result (?github=connected|error), then
  // strip the flag so a refresh doesn't re-toast.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('github');
    if (!status) return;
    if (status === 'connected') {
      toast.show({ tone: 'success', message: 'GitHub repository connected.' });
    } else {
      toast.show({ tone: 'danger', message: 'GitHub connection failed. Please try again.' });
    }
    window.history.replaceState({}, '', location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(e) {
    e.preventDefault();
    const value = repo.trim();
    if (!REPO_RE.test(value)) {
      toast.show({ tone: 'danger', message: 'Enter the repository as "owner/repo".' });
      return;
    }
    setConnecting(true);
    try {
      const { authorizeUrl } = await integrationsApi.authorizeGitHub(
        project.id, value, location.pathname);
      // Full-page redirect into GitHub's consent screen.
      window.location.href = authorizeUrl;
    } catch (err) {
      const status = err.response?.status;
      const msg = status === 503
        ? 'GitHub integration is not configured on the server.'
        : status === 409
        ? 'That repository is already linked to a project.'
        : err.response?.data?.detail ?? 'Could not start the GitHub connection.';
      toast.show({ tone: 'danger', message: msg });
      setConnecting(false);
    }
  }

  async function disconnect(integration) {
    if (!confirm(`Disconnect ${integration.repoFullName}? The repo webhook will be removed.`)) return;
    setBusyId(integration.id);
    try {
      await integrationsApi.disconnect(integration.id);
      setIntegrations((cur) => cur.filter((i) => i.id !== integration.id));
      toast.show({ tone: 'success', message: 'Repository disconnected.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not disconnect.',
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="main-inner"><Skeleton height={200} radius="lg" /></div>;
  }

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">{project?.name ?? 'Project'} · Settings</p>
            <h1 className="page-title">Integrations</h1>
            <p className="page-subtitle">
              Link a GitHub repository so branches, pull requests, and CI keep
              your tasks in sync. Reference a task by its key (e.g.{' '}
              <span className="mono">{project?.key ? `${project.key}-123` : 'AT-123'}</span>)
              in the branch name or PR title.
            </p>
          </div>
        </div>
      </header>

      <section className="intg-card">
        <div className="intg-card-head">
          <GitBranch size={16} aria-hidden="true" />
          <h2>GitHub</h2>
        </div>

        {canEdit ? (
          <form className="intg-connect" onSubmit={connect}>
            <Input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo"
              aria-label="GitHub repository (owner/repo)"
              disabled={connecting}
            />
            <Button type="submit" variant="primary" disabled={connecting || !repo.trim()}>
              <Plug size={13} aria-hidden="true" />
              {connecting ? ' Redirecting…' : ' Connect repository'}
            </Button>
          </form>
        ) : (
          <p className="muted intg-readonly">Only a project manager can connect repositories.</p>
        )}

        {integrations.length === 0 ? (
          <p className="intg-empty">No repositories connected yet.</p>
        ) : (
          <ul className="intg-list">
            {integrations.map((i) => (
              <li key={i.id} className="intg-row">
                <a className="intg-repo" href={i.repoUrl} target="_blank" rel="noreferrer">
                  <GitBranch size={14} aria-hidden="true" />
                  <span className="mono">{i.repoFullName}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
                <div className="intg-meta">
                  {i.webhookActive ? (
                    <Badge tone="success" dot>Webhook active</Badge>
                  ) : (
                    <Badge tone="warning" dot>Webhook pending</Badge>
                  )}
                  <span className="muted intg-by">
                    Connected by {i.connectedByName}
                  </span>
                  {i.lastEventAt && (
                    <span className="muted intg-by">
                      · last event {new Date(i.lastEventAt).toLocaleDateString([], {
                        month: 'short', day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect(i)}
                    disabled={busyId === i.id}
                  >
                    <Trash2 size={12} aria-hidden="true" /> Disconnect
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="intg-hint">
        <div className="intg-hint-row">
          <CircleCheck size={14} aria-hidden="true" className="intg-ok" />
          <span>A new branch like <span className="mono">feat/{project?.key ?? 'AT'}-123-…</span> moves that task to In&nbsp;Progress.</span>
        </div>
        <div className="intg-hint-row">
          <CircleCheck size={14} aria-hidden="true" className="intg-ok" />
          <span>Merging its pull request closes the task.</span>
        </div>
        <div className="intg-hint-row">
          <CircleAlert size={14} aria-hidden="true" className="intg-warn" />
          <span>A failing CI run flags the task with a red check.</span>
        </div>
      </section>
    </div>
  );
}
