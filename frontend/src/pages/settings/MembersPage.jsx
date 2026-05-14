import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Input, Select } from '@/components/ui';
import { invitationsApi } from '@/api/invitations.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import './MembersPage.css';

const ROLE_OPTIONS = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Member', label: 'Member' },
  { value: 'Guest', label: 'Guest' },
];

export function MembersPage() {
  const { slug } = useParams();
  const { isAdminOrAbove, loaded } = useOrgRole(slug);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Member');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loaded) {
    return <p className="members__placeholder">Loading…</p>;
  }
  if (!isAdminOrAbove) {
    return <p className="members__placeholder">Admin access required.</p>;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const invite = await invitationsApi.create(slug, { email: email.trim(), role });
      setSuccess(
        `Invitation sent to ${invite.email}. In dev the accept link is logged to the backend console.`,
      );
      setEmail('');
      setRole('Member');
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not send invitation.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="members">
      <h1 className="members__title">Members</h1>

      <Card title="Invite a member" className="members__card">
        <form className="members__form" onSubmit={onSubmit}>
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
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />

          {error && <p className="members__error">{error}</p>}
          {success && <p className="members__success">{success}</p>}

          <Button type="submit" disabled={submitting || email.trim().length === 0}>
            {submitting ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
      </Card>

      <p className="members__placeholder">
        Full members list lands in F1-05.
      </p>
    </div>
  );
}
