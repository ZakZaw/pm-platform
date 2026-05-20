import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Input, Select, Table } from '@/components/ui';
import { invitationsApi } from '@/api/invitations.api';
import { orgsApi } from '@/api/orgs.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import { useConfirm } from '@/hooks/useConfirm';
import './MembersPage.css';

const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Member', label: 'Member' },
  { value: 'Guest', label: 'Guest' },
];

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'Owner', label: 'Owner' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Member', label: 'Member' },
  { value: 'Guest', label: 'Guest' },
];

const ROLE_TONE = {
  Owner: 'purple',
  Admin: 'info',
  Member: 'neutral',
  Guest: 'neutral',
};

const PAGE_SIZE = 20;

export function MembersPage() {
  const { slug } = useParams();
  const { role: myRole, isOwner, isAdminOrAbove, loaded } = useOrgRole(slug);
  const { confirm, dialog } = useConfirm();

  // Invite form state
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [inviting, setInviting] = useState(false);

  // List state
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [listError, setListError] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  // Bumped after a role-change / remove to trigger a refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  // 250ms debounce on search so we don't fire per keystroke. The search
  // Input's onChange resets page=1; this effect only commits the debounced
  // value to the fetch dep array.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!myRole) return undefined;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const data = await orgsApi.listMembers(slug, {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          role: roleFilter || undefined,
        });
        if (cancelled) return;
        setMembers(data.items);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) return;
        setListError(err.response?.data?.detail ?? 'Could not load members.');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, page, debouncedSearch, roleFilter, refreshKey, myRole]);

  if (!loaded) {
    return <p className="members__placeholder">Loading…</p>;
  }
  if (!myRole) {
    return <p className="members__placeholder">You don't have access to this organization.</p>;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setInviting(true);
    try {
      const invite = await invitationsApi.create(slug, { email: email.trim(), role: inviteRole });
      setInviteSuccess(
        `Invitation sent to ${invite.email}. In dev the accept link is logged to the backend console.`,
      );
      setEmail('');
      setInviteRole('Member');
    } catch (err) {
      setInviteError(err.response?.data?.detail ?? 'Could not send invitation.');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="page members">
      {dialog}
      <h1 className="members__title">Members</h1>

      {isAdminOrAbove && (
        <Card title="Invite a member" className="members__card">
          <form className="members__form" onSubmit={onInvite}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="teammate@company.com"
              autoComplete="off"
            />
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            />

            {inviteError && <p className="members__error">{inviteError}</p>}
            {inviteSuccess && <p className="members__success">{inviteSuccess}</p>}

            <Button type="submit" disabled={inviting || email.trim().length === 0}>
              {inviting ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </Card>
      )}

      <Card title="Directory" className="members__card">
        <div className="members__filters">
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Name or email…"
          />
          <Select
            label="Filter by role"
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {listError && <p className="members__error">{listError}</p>}

        <MemberTable
          members={members}
          isOwner={isOwner}
          isAdminOrAbove={isAdminOrAbove}
          loading={listLoading}
          onRoleChange={async (m, newRole) => {
            try {
              await orgsApi.updateMemberRole(slug, m.userId, newRole);
              setRefreshKey((k) => k + 1);
            } catch (err) {
              setListError(err.response?.data?.detail ?? 'Could not change role.');
            }
          }}
          onRemove={async (m) => {
            const ok = await confirm({
              title: `Remove ${m.fullName}?`,
              message: `${m.fullName} will lose access to this organization and every project in it. Their work history stays put.`,
              confirmLabel: 'Remove member',
            });
            if (!ok) return;
            try {
              await orgsApi.removeMember(slug, m.userId);
              setRefreshKey((k) => k + 1);
            } catch (err) {
              setListError(err.response?.data?.detail ?? 'Could not remove member.');
            }
          }}
        />

        {totalPages > 1 && (
          <div className="members__pager">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="members__pager-info">
              Page {page} of {totalPages} · {total} {total === 1 ? 'member' : 'members'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function MemberTable({ members, isOwner, isAdminOrAbove, loading, onRoleChange, onRemove }) {
  const allRoleOptions = useMemo(
    () => [
      { value: 'Owner', label: 'Owner' },
      { value: 'Admin', label: 'Admin' },
      { value: 'Member', label: 'Member' },
      { value: 'Guest', label: 'Guest' },
    ],
    [],
  );

  if (loading && members.length === 0) {
    return <p className="members__placeholder">Loading members…</p>;
  }
  if (!loading && members.length === 0) {
    return <p className="members__placeholder">No members match.</p>;
  }

  return (
    <Table className="members__table">
      <Table.Head>
        <Table.Row>
          <Table.Header>Name</Table.Header>
          <Table.Header>Role</Table.Header>
          <Table.Header>Joined</Table.Header>
          <Table.Header align="right">Actions</Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {members.map((m) => {
          const canManage = isAdminOrAbove && (m.role !== 'Owner' || isOwner);
          return (
            <Table.Row key={m.userId}>
              <Table.Cell>
                <div className="members__person">
                  <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                  <div>
                    <div className="members__person-name">{m.fullName}</div>
                    <div className="members__person-email">{m.email}</div>
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell>
                <Badge tone={ROLE_TONE[m.role] ?? 'neutral'}>{m.role}</Badge>
              </Table.Cell>
              <Table.Cell>
                {new Date(m.joinedAt).toLocaleDateString()}
              </Table.Cell>
              <Table.Cell align="right">
                {canManage ? (
                  <div className="members__row-actions">
                    <Select
                      options={allRoleOptions.filter(
                        // Only Owners can promote anyone to Owner.
                        (o) => o.value !== 'Owner' || isOwner,
                      )}
                      value={m.role}
                      onChange={(e) => onRoleChange(m, e.target.value)}
                      aria-label={`Role for ${m.fullName}`}
                    />
                    <Button variant="ghost" size="sm" onClick={() => onRemove(m)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <span className="members__dim">—</span>
                )}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}
