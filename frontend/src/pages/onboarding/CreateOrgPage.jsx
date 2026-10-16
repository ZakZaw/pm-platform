import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Input } from '@/components/ui';
import { orgsApi } from '@/api/orgs.api';
import { useOrgStore } from '@/store/orgStore';
import './CreateOrgPage.css';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function CreateOrgPage() {
  const navigate = useNavigate();
  const refreshOrgs = useOrgStore((s) => s.refresh);

  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!logoPreview) return undefined;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const onPickFile = (e) => {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Logo must be a PNG, JPEG, or WebP image.');
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Logo file must be 2 MB or less.');
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const org = await orgsApi.create({ name, logo: logoFile });
      await refreshOrgs();
      navigate(`/${org.slug}/home`, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail ?? 'Could not create organization.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="main-inner create-org">
      <div className="card create-org-card">
        <div className="create-org-head">
          <h1 className="create-org-title">Create your organization</h1>
          <p className="muted create-org-sub">
            Your team's workspace. You can change the name and logo later.
          </p>
        </div>

        <form className="create-org-form" onSubmit={onSubmit}>
          <div className="create-org-logo-row">
            <button
              type="button"
              className="create-org-logo"
              onClick={() => fileInputRef.current?.click()}
              aria-label={logoFile ? 'Replace logo' : 'Upload logo'}
            >
              <Avatar src={logoPreview} name={name || 'Organization'} size="xl" />
            </button>
            <div className="create-org-logo-text">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoFile ? 'Replace logo' : 'Upload logo'}
              </Button>
              <p className="create-org-logo-help">PNG, JPEG, or WebP. Max 2 MB.</p>
              <input
                ref={fileInputRef}
                className="create-org-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickFile}
              />
            </div>
          </div>

          <Input
            label="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            placeholder="Acme Corp"
            autoComplete="organization"
          />

          {error && <p className="create-org-error" role="alert">{error}</p>}

          <Button type="submit" size="lg" block disabled={submitting || name.trim().length < 2}>
            {submitting ? 'Creating…' : 'Create organization'}
          </Button>
        </form>
      </div>
    </div>
  );
}