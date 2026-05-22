import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { supportApi } from '@/api/support.api';
import './CustomersPage.css';

export function CustomersPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  async function refresh(projectId, q) {
    const rows = await supportApi.listCustomers(projectId, { search: q || undefined });
    setCustomers(rows);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await projectsApi.getBySlug(orgSlug, projectSlug);
      if (cancelled) return;
      setProject(p);
      await refresh(p.id, search);
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, search]);

  return (
    <div className="page customers-page">
      <header className="page-header">
        <h1 className="page-title">Customers</h1>
        <div className="hstack" style={{ gap: 8 }}>
          <div className="customers-page__search">
            <Search size={13} aria-hidden="true" />
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, company…"
            />
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New customer
          </Button>
        </div>
      </header>

      {!customers ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
        </div>
      ) : customers.length === 0 ? (
        <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
          {search ? `No customers match "${search}".` : 'No customers yet.'}
        </div>
      ) : (
        <div className="customers-page__table" role="table">
          <div className="customers-page__row customers-page__row--head" role="row">
            <span>Name</span>
            <span>Email</span>
            <span>Company</span>
            <span>Tier</span>
            <span>Open / Total</span>
          </div>
          {customers.map((c) => (
            <div key={c.id} className="customers-page__row" role="row">
              <span className="customers-page__name">{c.name}</span>
              <span className="muted">{c.email ?? '—'}</span>
              <span className="muted">{c.company ?? '—'}</span>
              <span>{c.tier ? <Badge tone="purple">{c.tier}</Badge> : <span className="muted">—</span>}</span>
              <span className="mono">
                <Badge tone={c.openTicketCount > 0 ? 'info' : 'neutral'}>{c.openTicketCount}</Badge>
                <span className="muted"> / {c.totalTicketCount}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {creating && project && (
        <CreateCustomerModal
          projectId={project.id}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh(project.id, search).catch(() => {});
            toast.show({ tone: 'success', message: 'Customer created.' });
          }}
        />
      )}
    </div>
  );
}

function CreateCustomerModal({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [tier, setTier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await supportApi.createCustomer(projectId, {
        name: name.trim(),
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        tier: tier.trim() || undefined,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create customer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-customer-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="create-customer-title" style={{ margin: 0, fontSize: 16 }}>New customer</h2>
        </ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
            <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Free / Standard / Premium / Enterprise" />
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
