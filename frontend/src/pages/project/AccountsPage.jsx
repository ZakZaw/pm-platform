import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { salesApi } from '@/api/sales.api';
import './AccountsPage.css';

function fmtCurrency(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  } catch {
    return value;
  }
}

export function AccountsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [creating, setCreating] = useState(false);

  async function refresh(projectId) {
    const rows = await salesApi.listAccounts(projectId);
    setAccounts(rows);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await projectsApi.getBySlug(orgSlug, projectSlug);
      if (cancelled) return;
      setProject(p);
      await refresh(p.id);
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  return (
    <div className="page accounts">
      <header className="page-header">
        <h1 className="page-title">Accounts</h1>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={13} aria-hidden="true" /> New account
        </Button>
      </header>

      {!accounts ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
          No accounts yet. Create one to start building a pipeline.
        </div>
      ) : (
        <div className="accounts__table" role="table">
          <div className="accounts__row accounts__row--head" role="row">
            <span role="columnheader">Name</span>
            <span role="columnheader">Domain</span>
            <span role="columnheader">Industry</span>
            <span role="columnheader">Open deals</span>
            <span role="columnheader">Value</span>
          </div>
          {accounts.map((a) => (
            <div key={a.id} className="accounts__row" role="row">
              <span role="cell" className="accounts__name">{a.name}</span>
              <span role="cell" className="muted">{a.domain ?? '—'}</span>
              <span role="cell" className="muted">{a.industry ?? '—'}</span>
              <span role="cell">
                <Badge tone={a.openDealCount > 0 ? 'info' : 'neutral'}>{a.openDealCount}</Badge>
              </span>
              <span role="cell" className="mono">{fmtCurrency(a.openDealValue, 'USD')}</span>
            </div>
          ))}
        </div>
      )}

      {creating && project && (
        <CreateAccountModal
          projectId={project.id}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh(project.id).catch(() => {});
            toast.show({ tone: 'success', message: 'Account created.' });
          }}
        />
      )}
    </div>
  );
}

function CreateAccountModal({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await salesApi.createAccount(projectId, {
        name: name.trim(),
        domain: domain.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-account-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="create-account-title" style={{ margin: 0, fontSize: 16 }}>New account</h2>
        </ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
            <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            <Input label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" />
            {error && <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create'}</Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
