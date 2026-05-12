import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import './AuthPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname ?? '/dashboard';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
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
