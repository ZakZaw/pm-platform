import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import './AuthPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const refreshOrgs = useOrgStore((s) => s.refresh);

  const inviteToken = searchParams.get('invite');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      if (inviteToken) {
        navigate(`/invitations/${inviteToken}`, { replace: true });
      } else if (from) {
        navigate(from, { replace: true });
      } else {
        const orgs = await refreshOrgs();
        const target = orgs.length === 0 ? '/onboarding/create-org' : `/${orgs[0].slug}/home`;
        navigate(target, { replace: true });
      }
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Login failed.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Card title="Sign in" subtitle="Welcome back" className="auth-page__card">
        <form className="auth-page__form" onSubmit={onSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="auth-page__error">{error}</p>}
          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="auth-page__footer">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </Card>
    </div>
  );
}
