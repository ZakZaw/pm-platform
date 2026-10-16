import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { projectsApi } from '@/api/projects.api';
import { marketingApi } from '@/api/marketing.api';
import { MARKETING_CHANNELS } from '@/constants/projectTypes';
import { CampaignDetailDrawer } from '@/components/marketing/CampaignDetailDrawer';
import { CAMPAIGN_STATUS_CLASS, channelClass } from '@/components/marketing/channel';
import '@/components/marketing/channel.css';
import './CampaignsPage.css';

function fmtDateRange(start, end) {
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (!start && !end) return 'Unscheduled';
  if (start && !end) return `From ${fmt(start)}`;
  if (!start && end) return `Until ${fmt(end)}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtBudget(amount, currency) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? ''} ${amount}`;
  }
}

export function CampaignsPage() {
  const { slug: orgSlug, projectSlug } = useParams();
  const toast = useToast();
  const [project, setProject] = useState(null);
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [openCampaignId, setOpenCampaignId] = useState(null);

  async function refresh(projectId) {
    const rows = await marketingApi.listCampaigns(projectId);
    setCampaigns(rows);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await projectsApi.getBySlug(orgSlug, projectSlug);
        if (cancelled) return;
        setProject(p);
        await refresh(p.id);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load campaigns.');
      }
    })();
    return () => { cancelled = true; };
  }, [orgSlug, projectSlug]);

  if (error) {
    return <div className="main-inner"><p className="muted">{error}</p></div>;
  }

  return (
    <div className="main-inner campaigns-page">
      <div className="page-head">
        <div className="page-title-row">
          <div>
            {project && <div className="eyebrow">{project.name}</div>}
            <h1 className="page-title">Campaigns</h1>
            <div className="page-subtitle">
              {campaigns?.length
                ? `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} · `
                : ''}
              Group assets, tasks, and budget under a campaign. Track progress per channel.
            </div>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={13} aria-hidden="true" /> New campaign
          </Button>
        </div>
      </div>

      {!campaigns ? (
        <div className="campaigns-page-grid">
          {[0, 1, 2].map((i) => <Skeleton key={i} height={168} radius="lg" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={20} aria-hidden="true" />}
          title="No campaigns yet"
          subtitle="Group your assets and tasks under a campaign — by channel, season, or launch."
        >
          <Button variant="secondary" onClick={() => setCreating(true)}>Create a campaign</Button>
        </EmptyState>
      ) : (
        <div className="campaigns-page-grid">
          {campaigns.map((c) => {
            const pct = c.assetCount === 0 ? 0
              : Math.round((c.publishedAssetCount / c.assetCount) * 100);
            const budget = fmtBudget(c.budgetAmount, c.budgetCurrency);
            return (
              <div
                key={c.id}
                className={`card campaign-card ${channelClass(c.channel)}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenCampaignId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenCampaignId(c.id);
                  }
                }}
              >
                <div className="campaign-card-top">
                  <span className="mkt-ch-label">{c.channel}</span>
                  <span className={`status ${CAMPAIGN_STATUS_CLASS[c.status] ?? 'status-todo'}`}>
                    {c.status}
                  </span>
                </div>
                <div className="campaign-card-title">{c.name}</div>
                <div className="campaign-card-meta">
                  <span>{fmtDateRange(c.startDate, c.endDate)}</span>
                  {budget && <span>{budget}</span>}
                </div>
                <div className="campaign-card-progress">
                  <div className="bar">
                    <div className="bar-fill campaign-card-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="campaign-card-counts">
                    {c.publishedAssetCount}/{c.assetCount} assets · {c.doneTaskCount}/{c.taskCount} tasks
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creating && project && (
        <CreateCampaignModal
          projectId={project.id}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            await refresh(project.id).catch(() => {});
            toast.show({ tone: 'success', message: 'Campaign created.' });
          }}
        />
      )}

      {openCampaignId && (
        <CampaignDetailDrawer
          campaignId={openCampaignId}
          onClose={() => setOpenCampaignId(null)}
          onChanged={() => project && refresh(project.id).catch(() => {})}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ projectId, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('Email');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await marketingApi.createCampaign(projectId, {
        name: name.trim(),
        channel,
        startDate: startDate || null,
        endDate: endDate || null,
        goalMd: goal.trim() || null,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create campaign.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-campaign-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="create-campaign-title" className="modal-title">New campaign</h2>
        </ModalHeader>
        <ModalBody>
          <div className="col gap-5">
            <Input
              label="Name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Q4 product launch"
            />
            <Select
              label="Channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              options={MARKETING_CHANNELS.map((c) => ({ value: c, label: c }))}
            />
            <div className="grid-2">
              <Input
                label="Start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="End"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Input
              label="Goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. 200 trial signups"
            />
            {error && <p className="input-help is-error">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
