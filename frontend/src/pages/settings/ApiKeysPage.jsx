import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Select, Skeleton, useToast } from '@/components/ui';
import { apiKeysApi } from '@/api/apiKeys.api';
import { useOrgRole } from '@/hooks/useOrgRole';
import './ApiKeysPage.css';

const EXPIRY_OPTIONS = [
  { value: '', label: 'Never expires' },
  { value: '30', label: 'Expires in 30 days' },
  { value: '90', label: 'Expires in 90 days' },
  { value: '365', label: 'Expires in 1 year' },
];

/**
 * F2-24 — org Owner/Admin page to mint and revoke public REST API keys.
 * The full secret is shown exactly once, right after creation.
 */
export function ApiKeysPage() {
  const { slug } = useParams();
  const toast = useToast();
  const { isAdminOrAbove, loaded } = useOrgRole(slug);

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Refresh used by the create / revoke handlers (event handlers may
  // setState freely; the mount fetch lives in the effect below).
  const load = useCallback(async () => {
    try {
      setKeys(await apiKeysApi.list(slug));
    } catch { /* non-admins get 403; the gate below explains */ }
  }, [slug]);

  useEffect(() => {
    if (!loaded || !isAdminOrAbove) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiKeysApi.list(slug);
        if (!cancelled) setKeys(data);
      } catch {
        /* surfaced via empty state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loaded, isAdminOrAbove, slug]);

  async function create(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.show({ tone: 'danger', message: 'Give the key a name (min 2 characters).' });
      return;
    }
    setCreating(true);
    try {
      const res = await apiKeysApi.create(slug, {
        name: trimmed,
        expiresInDays: expiry ? Number(expiry) : null,
      });
      setNewSecret(res.secret);
      setCopied(false);
      setName('');
      setExpiry('');
      await load();
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not create the key.',
      });
    } finally {
      setCreating(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopied(true);
      toast.show({ tone: 'success', message: 'Secret copied to clipboard.' });
    } catch {
      toast.show({ tone: 'danger', message: 'Copy failed — select and copy manually.' });
    }
  }

  async function revoke(key) {
    if (!confirm(`Revoke "${key.name}"? Any service using it will stop working immediately.`)) return;
    setBusyId(key.id);
    try {
      await apiKeysApi.revoke(key.id);
      await load();
      toast.show({ tone: 'success', message: 'Key revoked.' });
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not revoke.' });
    } finally {
      setBusyId(null);
    }
  }

  function statusBadge(k) {
    if (k.revokedAt) return <Badge tone="danger">Revoked</Badge>;
    if (!k.isActive) return <Badge tone="warning">Expired</Badge>;
    return <Badge tone="success" dot>Active</Badge>;
  }

  if (!loaded) {
    return <div className="main-inner"><Skeleton height={200} radius="lg" /></div>;
  }

  if (!isAdminOrAbove) {
    return (
      <div className="main-inner">
        <header className="page-head">
          <div className="page-title-row">
            <div>
              <p className="eyebrow">Settings</p>
              <h1 className="page-title">API keys</h1>
            </div>
          </div>
        </header>
        <p className="muted">Only an organization owner or admin can manage API keys.</p>
      </div>
    );
  }

  return (
    <div className="main-inner">
      <header className="page-head">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">Settings</p>
            <h1 className="page-title">API keys</h1>
            <p className="page-subtitle">
              Programmatic access to the REST API for service-to-service use.
              Send the key as an <span className="mono">X-Api-Key</span> header.
              Explore the API at <a href="/swagger" target="_blank" rel="noreferrer">/swagger</a>.
            </p>
          </div>
        </div>
      </header>

      <section className="ak-card">
        <form className="ak-create" onSubmit={create}>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI pipeline"
            disabled={creating}
          />
          <Select
            label="Expiry"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            options={EXPIRY_OPTIONS}
            disabled={creating}
          />
          <Button type="submit" variant="primary" disabled={creating || name.trim().length < 2}>
            <Plus size={13} aria-hidden="true" /> {creating ? 'Creating…' : 'Create key'}
          </Button>
        </form>

        {newSecret && (
          <div className="ak-secret">
            <div className="ak-secret-head">
              <KeyRound size={14} aria-hidden="true" />
              <span>Copy your key now — it won't be shown again.</span>
            </div>
            <div className="ak-secret-row">
              <code className="ak-secret-value">{newSecret}</code>
              <Button size="sm" variant="secondary" onClick={copySecret}>
                {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                {copied ? ' Copied' : ' Copy'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <Skeleton height={160} radius="lg" />
      ) : keys.length === 0 ? (
        <p className="ak-empty">No API keys yet.</p>
      ) : (
        <ul className="ak-list">
          {keys.map((k) => (
            <li key={k.id} className={`ak-row ${k.isActive ? '' : 'is-inactive'}`}>
              <div className="ak-row-main">
                <span className="ak-name">{k.name}</span>
                <code className="ak-prefix mono">{k.prefix}…</code>
                {statusBadge(k)}
              </div>
              <div className="ak-row-meta muted">
                <span>by {k.createdByName}</span>
                <span>· created {new Date(k.createdAt).toLocaleDateString()}</span>
                {k.lastUsedAt && <span>· last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                {k.expiresAt && <span>· expires {new Date(k.expiresAt).toLocaleDateString()}</span>}
              </div>
              {!k.revokedAt && (
                <Button size="sm" variant="ghost" onClick={() => revoke(k)} disabled={busyId === k.id}>
                  <Trash2 size={12} aria-hidden="true" /> Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
