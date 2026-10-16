import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useOrgStore } from '@/store/orgStore';
import { AuthLayout } from './AuthLayout';

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
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your workspace"
      footer={<>New here? <Link to="/register">Create an account</Link></>}
    >
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
        <Button type="submit" size="lg" block disabled={submitting} className="auth-page__submit">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
