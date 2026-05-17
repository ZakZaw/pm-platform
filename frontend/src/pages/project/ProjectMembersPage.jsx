import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Avatar, Badge, Button, Card, Select, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import './ProjectMembersPage.css';

const ROLE_OPTIONS = [
  { value: 'PM', label: 'PM' },
  { value: 'TeamLead', label: 'Team lead' },
  { value: 'Contributor', label: 'Contributor' },
  { value: 'Viewer', label: 'Viewer' },
];

const ROLE_TONE = {
  PM: 'purple',
  TeamLead: 'info',
  Contributor: 'success',
  Viewer: 'neutral',
};

export function ProjectMembersPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();

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
    if (!window.confirm('Remove this member from the project?')) return;
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

  if (loading) return <p className="pmembers__placeholder">Loading…</p>;
  if (error) return <p className="pmembers__placeholder">{error}</p>;

  return (
    <div className="pmembers">
      <header className="pmembers__header">
        <h1 className="pmembers__title">Project members</h1>
        <p className="pmembers__sub">
          Only members of {project?.orgSlug ? `the "${project.orgSlug}" org` : 'this organisation'} can be added.
        </p>
      </header>

      <Card className="pmembers__card" title="Add a member">
        <div className="pmembers__add">
          <Select
            label="Org member"
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
            label="Role"
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value)}
            options={ROLE_OPTIONS}
          />
          <Button onClick={addMember} disabled={!pickUserId || busy}>
            {busy ? 'Adding…' : 'Add to project'}
          </Button>
        </div>
      </Card>

      <Card className="pmembers__card" title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <p className="pmembers__placeholder">No members yet.</p>
        ) : (
          <ul className="pmembers__list">
            {members.map((m) => (
              <li key={m.userId} className="pmembers__row">
                <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                <div className="pmembers__row-name">
                  <div>{m.fullName}</div>
                  <div className="pmembers__row-email">{m.email}</div>
                </div>
                <Badge tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role}</Badge>
                <Select
                  value={m.role}
                  onChange={(e) => changeRole(m.userId, e.target.value)}
                  options={ROLE_OPTIONS}
                  aria-label={`Role for ${m.fullName}`}
                />
                <button
                  type="button"
                  className="pmembers__delete"
                  onClick={() => removeMember(m.userId)}
                  aria-label={`Remove ${m.fullName}`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
