import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useToast,
} from '@/components/ui';
import { marketingApi } from '@/api/marketing.api';
import {
  ASSET_STATUSES,
  ASSET_STATUS_TONE,
  ASSET_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_TONE,
  MARKETING_CHANNELS,
  channelTokens,
} from '@/constants/projectTypes';
import './CampaignDetailDrawer.css';

const TASK_STATUSES = ['ToDo', 'InProgress', 'Done', 'Cancelled'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function CampaignDetailDrawer({ campaignId, onClose, onChanged }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reasonModal, setReasonModal] = useState(null);

  const load = useCallback(async () => {
    const data = await marketingApi.getCampaign(campaignId);
    setDetail(data);
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await marketingApi.getCampaign(campaignId);
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load campaign.');
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function patchCampaign(patch) {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await marketingApi.updateCampaign(detail.campaign.id, patch);
      setDetail({ ...detail, campaign: updated });
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not save',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function applyAssetStatus(asset, to, reason) {
    try {
      await marketingApi.changeAssetStatus(asset.id, { to, reason });
      await load();
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not change status',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    }
  }

  async function changeAssetStatus(asset, to) {
    if (asset.status === 'Review' && to === 'Draft') {
      setReasonModal({ asset, to });
      return;
    }
    await applyAssetStatus(asset, to, null);
  }

  async function deleteAsset(asset) {
    if (!window.confirm(`Delete asset "${asset.title}"?`)) return;
    try {
      await marketingApi.deleteAsset(asset.id);
      await load();
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not delete asset',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    }
  }

  async function toggleTask(task) {
    const nextStatus = task.status === 'Done' ? 'ToDo' : 'Done';
    try {
      await marketingApi.updateTask(task.id, { status: nextStatus });
      await load();
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not update task',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    }
  }

  async function deleteTask(task) {
    try {
      await marketingApi.deleteTask(task.id);
      await load();
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not delete task',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    }
  }

  const campaign = detail?.campaign;
  const channelToks = campaign ? channelTokens(campaign.channel) : null;

  return createPortal(
    <div className="campaign-drawer__backdrop" onClick={onClose}>
      <aside
        className="campaign-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="campaign-drawer__head">
          <div className="hstack" style={{ gap: 8 }}>
            {campaign && channelToks && (
              <Badge style={{ background: channelToks.bg, color: channelToks.fg, borderColor: 'transparent' }}>
                {campaign.channel}
              </Badge>
            )}
            {campaign && (
              <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status] ?? 'neutral'}>
                {campaign.status}
              </Badge>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </header>

        {error && <p className="campaign-drawer__error">{error}</p>}
        {!campaign && !error && <p className="campaign-drawer__placeholder">Loading…</p>}

        {campaign && (
          <div className="campaign-drawer__body">
            <h2 className="campaign-drawer__title">{campaign.name}</h2>

            <div className="grid-2 campaign-drawer__fields">
              <Field label="Channel">
                <Select
                  value={campaign.channel}
                  onChange={(e) => patchCampaign({ channel: e.target.value })}
                  disabled={saving}
                  options={MARKETING_CHANNELS.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={campaign.status}
                  onChange={(e) => patchCampaign({ status: e.target.value })}
                  disabled={saving}
                  options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: s }))}
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="date"
                  value={campaign.startDate ? campaign.startDate.slice(0, 10) : ''}
                  onChange={(e) => {
                    if (e.target.value) patchCampaign({ startDate: e.target.value });
                    else patchCampaign({ clearStartDate: true });
                  }}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="date"
                  value={campaign.endDate ? campaign.endDate.slice(0, 10) : ''}
                  onChange={(e) => {
                    if (e.target.value) patchCampaign({ endDate: e.target.value });
                    else patchCampaign({ clearEndDate: true });
                  }}
                />
              </Field>
            </div>

            {campaign.goalMd && (
              <div>
                <div className="subsection-eyebrow">Goal</div>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{campaign.goalMd}</p>
              </div>
            )}

            <div className="subsection">
              <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="subsection-eyebrow">
                  Assets · {detail.assets.length}
                </div>
                <span className="muted" style={{ fontSize: 11 }}>
                  Draft → Review → Approved → Published
                </span>
              </div>
              {detail.assets.map((a) => (
                <div key={a.id} className="asset-row">
                  <div>
                    <div className="asset-row__title">{a.title}</div>
                    <div className="asset-row__meta">{a.type}</div>
                    {a.rejectionReason && a.status === 'Draft' && (
                      <div className="campaign-drawer__reason" style={{ marginTop: 4 }}>
                        <strong>Rejected:</strong> {a.rejectionReason}
                      </div>
                    )}
                  </div>
                  <Select
                    value={a.status}
                    onChange={(e) => changeAssetStatus(a, e.target.value)}
                    options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))}
                  />
                  <span className="asset-row__date">{fmtDate(a.publishDate)}</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => deleteAsset(a)}
                    aria-label="Delete asset"
                    title="Delete asset"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <CreateAssetInline
                campaignId={campaign.id}
                onCreated={async () => { await load(); onChanged?.(); }}
              />
            </div>

            <div className="subsection">
              <div className="subsection-eyebrow">
                Tasks · {detail.tasks.length}
              </div>
              {detail.tasks.map((t) => (
                <div key={t.id} className={`mtask-row${t.status === 'Done' ? ' is-done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={t.status === 'Done'}
                    onChange={() => toggleTask(t)}
                    aria-label={t.status === 'Done' ? 'Mark not done' : 'Mark done'}
                  />
                  <div className="mtask-row__title">
                    {t.title}
                    {t.assetTitle && (
                      <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
                        → {t.assetTitle}
                      </span>
                    )}
                  </div>
                  <Badge tone={t.status === 'Done' ? 'success' : t.status === 'InProgress' ? 'info' : 'neutral'}>
                    {t.status}
                  </Badge>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => deleteTask(t)}
                    aria-label="Delete task"
                    title="Delete task"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
              <CreateTaskInline
                campaignId={campaign.id}
                assets={detail.assets}
                onCreated={async () => { await load(); onChanged?.(); }}
              />
            </div>
          </div>
        )}

        {reasonModal && (
          <RejectionReasonModal
            asset={reasonModal.asset}
            onCancel={() => setReasonModal(null)}
            onConfirm={async (reason) => {
              const target = reasonModal;
              setReasonModal(null);
              await applyAssetStatus(target.asset, target.to, reason);
            }}
          />
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Field({ label, children }) {
  return (
    <div className="campaign-drawer__field">
      <div className="subsection-eyebrow">{label}</div>
      {children}
    </div>
  );
}

function CreateAssetInline({ campaignId, onCreated }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Email');
  const [publishDate, setPublishDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await marketingApi.createAsset(campaignId, {
        type,
        title: title.trim(),
        publishDate: publishDate || null,
      });
      setTitle('');
      setPublishDate('');
      onCreated?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not add asset',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="campaign-drawer__asset-form" onSubmit={submit}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New asset title…"
      />
      <Select
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={ASSET_TYPES.map((t) => ({ value: t, label: t }))}
      />
      <Input
        type="date"
        value={publishDate}
        onChange={(e) => setPublishDate(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        <Plus size={13} aria-hidden="true" /> Add
      </Button>
    </form>
  );
}

function CreateTaskInline({ campaignId, assets, onCreated }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [assetId, setAssetId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await marketingApi.createTask(campaignId, {
        title: title.trim(),
        assetId: assetId || null,
      });
      setTitle('');
      setAssetId('');
      onCreated?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not add task',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    } finally {
      setBusy(false);
    }
  }

  const assetOptions = [
    { value: '', label: 'No linked asset' },
    ...assets.map((a) => ({ value: a.id, label: a.title })),
  ];

  return (
    <form className="campaign-drawer__inline-form" onSubmit={submit}>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title…"
      />
      <Select
        value={assetId}
        onChange={(e) => setAssetId(e.target.value)}
        options={assetOptions}
      />
      <Button type="submit" size="sm" disabled={busy || !title.trim()}>
        <Plus size={13} aria-hidden="true" /> Add
      </Button>
    </form>
  );
}

function RejectionReasonModal({ asset, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onCancel} labelledBy="reject-asset-title">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="reject-asset-title" style={{ margin: 0, fontSize: 16 }}>Send back to Draft</h2>
        </ModalHeader>
        <ModalBody>
          <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
            Tell the asset's owner why <strong>{asset.title}</strong> needs more work.
          </p>
          <Input
            label="Reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Copy needs a stronger CTA…"
          />
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>
            {busy ? 'Sending…' : 'Send back'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
