import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Select, Skeleton, useToast } from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { salesApi } from '@/api/sales.api';
import './LeadsPage.css';

const STATUS_TONE = {
  New: 'info',
  Working: 'purple',
  Qualified: 'success',
  Disqualified: 'neutral',
  Converted: 'success',
};

const STATUS_FILTERS = [
  { value: '', label: 'All leads' },
  { value: 'New', label: 'New' },
  { value: 'Working', label: 'Working' },
  { value: 'Qualified', label: 'Qualified' },
  { value: 'Disqualified', label: 'Disqualified' },
  { value: 'Converted', label: 'Converted' },
];

export function LeadsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [leads, setLeads] = useState(null);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(null);

  async function refresh(projectId, status) {
    const rows = await salesApi.listLeads(projectId, { status: status || undefined });
    setLeads(rows);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = await projectsApi.getBySlug(orgSlug, projectSlug);
      if (cancelled) return;
      setProject(p);
      await refresh(p.id, filter);
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug, filter]);

  return (
    <div className="page leads">
      <header className="page-header">
        <h1 className="page-title">Leads</h1>
        <div className="hstack" style={{ gap: 8 }}>
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            options={STATUS_FILTERS}
          />
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New lead
          </Button>
        </div>
      </header>

      {!leads ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
          {filter ? `No ${filter} leads.` : 'No leads yet.'}
        </div>
      ) : (
        <div className="leads__list">
          {leads.map((l) => (
            <div key={l.id} className="leads__row">
              <div className="grow">
                <div className="leads__name">{l.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[l.email, l.phone, l.source].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <Badge tone={STATUS_TONE[l.status] ?? 'neutral'}>{l.status}</Badge>
              {l.status !== 'Converted' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConverting(l)}
                >
                  Convert
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && project && (
        <CreateLeadModal
          projectId={project.id}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh(project.id, filter).catch(() => {});
            toast.show({ tone: 'success', message: 'Lead created.' });
          }}
        />
      )}

      {converting && project && (
        <ConvertLeadModal
          projectId={project.id}
          lead={converting}
          onClose={() => setConverting(null)}
          onConverted={async () => {
            setConverting(null);
            await refresh(project.id, filter).catch(() => {});
            toast.show({ tone: 'success', message: 'Lead converted to deal.' });
          }}
        />
      )}
    </div>
  );
}

function CreateLeadModal({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await salesApi.createLead(projectId, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        source: source.trim() || undefined,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create lead.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-lead-title">
      <form onSubmit={submit}>
        <ModalHeader><h2 id="create-lead-title" style={{ margin: 0, fontSize: 16 }}>New lead</h2></ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
            <Input label="Name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Inbound / Referral / …" />
            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
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

function ConvertLeadModal({ projectId, lead, onClose, onConverted }) {
  const [stages, setStages] = useState([]);
  const [dealName, setDealName] = useState(`${lead.name} — Deal`);
  const [accountName, setAccountName] = useState(lead.name);
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    salesApi.listStages(projectId).then((rows) => {
      setStages(rows);
      setStageId(rows.find((s) => !s.isTerminalWon && !s.isTerminalLost)?.id ?? rows[0]?.id ?? '');
    }).catch(() => {});
  }, [projectId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await salesApi.convertLead(lead.id, {
        accountName: accountName.trim() || undefined,
        dealName: dealName.trim(),
        value: Number(value || 0),
        currency: 'USD',
        stageId: stageId || undefined,
      });
      onConverted?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not convert.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="convert-lead-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="convert-lead-title" style={{ margin: 0, fontSize: 16 }}>Convert lead</h2>
        </ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
            {!lead.accountId && (
              <Input
                label="Account name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                help="A new account will be created for this lead."
              />
            )}
            <Input label="Deal name" value={dealName} onChange={(e) => setDealName(e.target.value)} required />
            <Input label="Value (USD)" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
            <Select
              label="Initial stage"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              options={stages.filter((s) => !s.isTerminalWon && !s.isTerminalLost)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !dealName.trim()}>
            {busy ? 'Converting…' : 'Convert to deal'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
