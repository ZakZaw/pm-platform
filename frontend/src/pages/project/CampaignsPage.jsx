import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import {
  Badge,
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
import {
  CAMPAIGN_STATUS_TONE,
  MARKETING_CHANNELS,
  channelTokens,
} from '@/constants/projectTypes';
import { CampaignDetailDrawer } from '@/components/marketing/CampaignDetailDrawer';
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
    return <div className="page"><p style={{ color: 'var(--status-danger)' }}>{error}</p></div>;
  }

  return (
    <div className="page campaigns-page">
      <header className="page-header">
        <div className="hstack" style={{ gap: 12, alignItems: 'baseline' }}>
          <h1 className="page-title">Campaigns</h1>
          {campaigns && (
            <span className="muted">· {campaigns.length} total</span>
          )}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={13} aria-hidden="true" /> New campaign
        </Button>
      </header>

      {!campaigns ? (
        <div className="vstack" style={{ gap: 8 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone size={20} aria-hidden="true" />}
          title="No campaigns yet"
          subtitle="Group your assets and tasks under a campaign — by channel, season, or launch."
        >
          <Button onClick={() => setCreating(true)}>Create a campaign</Button>
        </EmptyState>
      ) : (
        <div className="campaigns-page__list">
          {campaigns.map((c) => {
            const tokens = channelTokens(c.channel);
            const pct = c.assetCount === 0 ? 0
              : Math.round((c.publishedAssetCount / c.assetCount) * 100);
            const budget = fmtBudget(c.budgetAmount, c.budgetCurrency);
            return (
              <div
                key={c.id}
                className="campaign-card"
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
                <div className="campaign-card__channel-bar" style={{ background: tokens.fg }} aria-hidden="true" />
                <div className="campaign-card__head">
                  <span className="campaign-card__title">{c.name}</span>
                  <div className="campaign-card__meta">
                    <Badge
                      style={{ background: tokens.bg, color: tokens.fg, borderColor: 'transparent' }}
                    >
                      {c.channel}
                    </Badge>
                    <Badge tone={CAMPAIGN_STATUS_TONE[c.status] ?? 'neutral'}>
                      {c.status}
                    </Badge>
                    <span>{fmtDateRange(c.startDate, c.endDate)}</span>
                    {budget && <span className="mono">{budget}</span>}
                  </div>
                </div>
                <div className="campaign-card__progress">
                  <span className="muted" style={{ fontSize: 11 }}>
                    {c.publishedAssetCount}/{c.assetCount} assets · {c.doneTaskCount}/{c.taskCount} tasks
                  </span>
                  <div className="campaign-card__bar">
                    <div className="campaign-card__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
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
          <h2 id="create-campaign-title" style={{ margin: 0, fontSize: 16 }}>New campaign</h2>
        </ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
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
            <div className="grid-2" style={{ gap: 12 }}>
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
            {error && <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>}
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
