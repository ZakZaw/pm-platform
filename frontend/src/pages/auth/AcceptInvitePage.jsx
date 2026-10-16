import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { invitationsApi } from '@/api/invitations.api';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { AuthLayout } from './AuthLayout';
import './AcceptInvitePage.css';

export function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken && s.user));
  const logout = useAuthStore((s) => s.logout);
  const refreshOrgs = useOrgStore((s) => s.refresh);

  const [state, setState] = useState({ status: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    invitationsApi
      .preview(token)
      .then((preview) => {
        if (cancelled) return;
        if (preview.isExpired) setState({ status: 'expired', preview });
        else if (preview.isAccepted) setState({ status: 'accepted', preview });
        else setState({ status: 'ready', preview });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'notfound' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onAccept = async () => {
    setAcceptError(null);
    setAccepting(true);
    try {
      const result = await invitationsApi.accept(token);
      await refreshOrgs();
      navigate(`/${result.organizationSlug}/home`, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not accept the invitation.';
      setAcceptError(detail);
    } finally {
      setAccepting(false);
    }
  };

  if (state.status === 'loading') {
    return <Shell><p className="invite-muted">Loading invitation…</p></Shell>;
  }
  if (state.status === 'notfound') {
    return (
      <Shell title="Invitation not found">
        <p>That invitation link doesn't exist. Ask the person who invited you to resend it.</p>
      </Shell>
    );
  }
  if (state.status === 'expired') {
    return (
      <Shell title="Invitation expired">
        <p>This invitation expired on {formatDate(state.preview.expiresAt)}. Ask {state.preview.inviterFullName} to send a new one.</p>
      </Shell>
    );
  }
  if (state.status === 'accepted') {
    return (
      <Shell title="Already accepted">
        <p>This invitation has already been used.</p>
        <Button onClick={() => navigate('/login')} size="lg" block>Sign in</Button>
      </Shell>
    );
  }

  // status === 'ready'
  const { preview } = state;
  const emailMatch =
    user && user.email && user.email.toLowerCase() === preview.email.toLowerCase();

  return (
    <Shell title={`Join ${preview.organizationName}`}>
      <p className="invite-lede">
        {preview.inviterFullName} invited <strong>{preview.email}</strong> to join{' '}
        <strong>{preview.organizationName}</strong> as <strong>{preview.role}</strong>.
      </p>

      {!isAuthenticated && (
        <div className="invite-actions">
          <Button
            block
            size="lg"
            onClick={() =>
              navigate(`/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(preview.email)}`)
            }
          >
            Create an account
          </Button>
          <Button
            block
            size="lg"
            variant="ghost"
            onClick={() => navigate(`/login?invite=${encodeURIComponent(token)}`)}
          >
            I already have an account
          </Button>
        </div>
      )}

      {isAuthenticated && !emailMatch && (
        <div className="invite-actions">
          <p className="invite-error">
            You're signed in as <strong>{user.email}</strong>, but this invite is for{' '}
            <strong>{preview.email}</strong>. Sign out and try again with the invited address.
          </p>
          <Button
            block
            variant="ghost"
            onClick={() => {
              logout();
              navigate(0);
            }}
          >
            Sign out
          </Button>
        </div>
      )}

      {isAuthenticated && emailMatch && (
        <div className="invite-actions">
          {acceptError && <p className="invite-error">{acceptError}</p>}
          <Button block size="lg" onClick={onAccept} disabled={accepting}>
            {accepting ? 'Joining…' : `Accept invitation`}
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <AuthLayout title={title}>
      <div className="invite">{children}</div>
    </AuthLayout>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
