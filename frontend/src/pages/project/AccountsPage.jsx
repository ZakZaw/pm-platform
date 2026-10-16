import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { Button, EmptyState, Input, Modal, ModalBody, ModalFooter, ModalHeader, Skeleton, useToast } from '@/components/ui';
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
    <div className="main-inner accounts">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Accounts</h1>
            <div className="page-subtitle">
              Companies you're working with, with their open deals and pipeline value.
            </div>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New account
          </Button>
        </div>
      </div>

      {!accounts ? (
        <div className="col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={48} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Building2 size={20} aria-hidden="true" />}
          title="No accounts yet"
          subtitle="Create one to start building a pipeline."
        >
          <Button variant="secondary" onClick={() => setCreating(true)}>New account</Button>
        </EmptyState>
      ) : (
        <div className="card accounts-card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Industry</th>
                <th className="accounts-num">Open deals</th>
                <th className="accounts-num">Value</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="accounts-name">{a.name}</td>
                  <td className="muted">{a.domain ?? '—'}</td>
                  <td className="muted">{a.industry ?? '—'}</td>
                  <td className={['accounts-num', a.openDealCount > 0 ? '' : 'muted'].filter(Boolean).join(' ')}>
                    {a.openDealCount}
                  </td>
                  <td className="accounts-num accounts-value">{fmtCurrency(a.openDealValue, 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <h2 id="create-account-title" className="modal-title">New account</h2>
        </ModalHeader>
        <ModalBody>
          <div className="col gap-5">
            <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            <Input label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="SaaS" />
            {error && <p className="input-help is-error">{error}</p>}
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
