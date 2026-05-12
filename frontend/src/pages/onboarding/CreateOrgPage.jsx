import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, Input } from '@/components/ui';
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
    <div className="create-org">
      <Card
        title="Create your organization"
        subtitle="Your team's workspace. You can change the name and logo later."
        className="create-org__card"
      >
        <form className="create-org__form" onSubmit={onSubmit}>
          <div className="create-org__logo-row">
            <Avatar src={logoPreview} name={name || 'Organization'} size="xl" />
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoFile ? 'Replace logo' : 'Upload logo'}
              </Button>
              <p className="create-org__logo-help">PNG, JPEG, or WebP. Max 2 MB.</p>
              <input
                ref={fileInputRef}
                className="create-org__file-input"
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

          {error && <p className="create-org__error">{error}</p>}

          <Button type="submit" block disabled={submitting || name.trim().length < 2}>
            {submitting ? 'Creating…' : 'Create organization'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
