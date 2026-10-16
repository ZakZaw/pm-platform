import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Avatar, Button, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useConfirm } from '@/hooks/useConfirm';
import './ProjectMembersPage.css';

const ROLE_OPTIONS = [
  { value: 'PM', label: 'PM' },
  { value: 'TeamLead', label: 'Team lead' },
  { value: 'Contributor', label: 'Contributor' },
  { value: 'Viewer', label: 'Viewer' },
];

export function ProjectMembersPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pickUserId, setPickUserId] = useState('');
  const [pickRole, setPickRole] = useState('Contributor');
  const [busy, setBusy] = useState(false);

  const { members: orgMembers } = useOrgMembers(orgSlug);

  const refresh = useCallback(async (projectId) => {
    const list = await projectsApi.listMembers(projectId);
    setMembers(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load members.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, refresh]);

  const eligibleOrgMembers = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.userId));
    return orgMembers.filter((om) => !memberIds.has(om.userId));
  }, [orgMembers, members]);

  async function addMember() {
    if (!pickUserId || !project) return;
    setBusy(true);
    try {
      const added = await projectsApi.addMember(project.id, {
        userId: pickUserId,
        role: pickRole,
      });
      setMembers((cur) => [...cur, added]);
      setPickUserId('');
      toast.show({ tone: 'success', message: 'Member added.' });
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not add member.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId, role) {
    try {
      const updated = await projectsApi.updateMemberRole(project.id, userId, role);
      setMembers((cur) => cur.map((m) => (m.userId === userId ? updated : m)));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not change role.',
      });
    }
  }

  async function removeMember(userId) {
    const member = members.find((m) => m.userId === userId);
    const ok = await confirm({
      title: member ? `Remove ${member.fullName}?` : 'Remove this member?',
      message: 'They will lose access to this project. Their tasks and comments stay put.',
      confirmLabel: 'Remove from project',
    });
    if (!ok) return;
    try {
      await projectsApi.removeMember(project.id, userId);
      setMembers((cur) => cur.filter((m) => m.userId !== userId));
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not remove member.',
      });
    }
  }

  if (loading) return <div className="main-inner"><p className="muted">Loading…</p></div>;
  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;

  return (
    <div className="main-inner pmembers">
      {dialog}
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <div className="eyebrow">{project?.name ?? 'Project'} · Settings</div>
            <h1 className="page-title">Members</h1>
            <div className="page-subtitle">
              {members.length} {members.length === 1 ? 'person' : 'people'} on this project. Only members of{' '}
              {project?.orgSlug ? `the "${project.orgSlug}" org` : 'this organisation'} can be added.
            </div>
          </div>
        </div>
      </div>

      <section className="card pmembers-card" aria-labelledby="pmembers-add-title">
        <h2 id="pmembers-add-title" className="pmembers-section-title">Add a member</h2>
        <div className="pmembers-add">
          <Select
            aria-label="Org member"
            value={pickUserId}
            onChange={(e) => setPickUserId(e.target.value)}
            options={[
              { value: '', label: eligibleOrgMembers.length === 0 ? 'No eligible members' : 'Pick a member…' },
              ...eligibleOrgMembers.map((m) => ({
                value: m.userId,
                label: `${m.fullName} — ${m.email}`,
              })),
            ]}
          />
          <Select
            aria-label="Role"
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value)}
            options={ROLE_OPTIONS}
          />
          <Button onClick={addMember} disabled={!pickUserId || busy}>
            {busy ? 'Adding…' : 'Add to project'}
          </Button>
        </div>
      </section>

      <section className="card pmembers-list-card" aria-label={`Members (${members.length})`}>
        {members.length === 0 ? (
          <p className="muted pmembers-empty">No members yet.</p>
        ) : (
          <ul className="pmembers-list">
            {members.map((m) => (
              <li key={m.userId} className="pmembers-row">
                <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                <div className="pmembers-row-name">
                  <div>{m.fullName}</div>
                  <div className="pmembers-row-email">{m.email}</div>
                </div>
                {/* The select is the role read-out; styled as plain text until hovered. */}
                <Select
                  className="pmembers-role"
                  value={m.role}
                  onChange={(e) => changeRole(m.userId, e.target.value)}
                  options={ROLE_OPTIONS}
                  aria-label={`Role for ${m.fullName}`}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-sm pmembers-delete"
                  onClick={() => removeMember(m.userId)}
                  aria-label={`Remove ${m.fullName}`}
                  title="Remove from project"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
