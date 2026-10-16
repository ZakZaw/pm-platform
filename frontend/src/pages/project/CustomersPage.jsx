import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Contact, Plus, Search } from 'lucide-react';
import {
  Button,
  EmptyState,
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
    <div className="main-inner customers-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Customers</h1>
            <div className="page-subtitle">
              People and companies who file tickets. Open counts surface who's escalating.
            </div>
          </div>
          <div className="row gap-3">
            <label className="customers-page-search">
              <Search size={14} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, company…"
                aria-label="Search customers"
              />
            </label>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={13} aria-hidden="true" /> New customer
            </Button>
          </div>
        </div>
      </div>

      {!customers ? (
        <div className="col gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Contact size={20} aria-hidden="true" />}
          title={search ? `No customers match "${search}".` : 'No customers yet.'}
        />
      ) : (
        <div className="card customers-page-card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Tier</th>
                <th className="customers-page-num">Open / Total</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="customers-page-name">{c.name}</td>
                  <td className="muted">{c.email ?? '—'}</td>
                  <td className="muted">{c.company ?? '—'}</td>
                  <td className="customers-page-tier">{c.tier ?? <span className="muted">—</span>}</td>
                  <td className="customers-page-num">
                    <span className={c.openTicketCount > 0 ? 'customers-page-open' : 'muted'}>
                      {c.openTicketCount}
                    </span>
                    <span className="muted"> / {c.totalTicketCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <h2 id="create-customer-title" className="modal-title">New customer</h2>
        </ModalHeader>
        <ModalBody>
          <div className="col gap-5">
            <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Free / Standard / Premium / Enterprise" />
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
