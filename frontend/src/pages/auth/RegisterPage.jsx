import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import './AuthPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ email, password, fullName });
      navigate('/onboarding/create-org', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Registration failed.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Card title="Create your account" subtitle="Start managing projects" className="auth-page__card">
        <form className="auth-page__form" onSubmit={onSubmit}>
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
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
            minLength={8}
            autoComplete="new-password"
          />
          {error && <p className="auth-page__error">{error}</p>}
          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="auth-page__footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
