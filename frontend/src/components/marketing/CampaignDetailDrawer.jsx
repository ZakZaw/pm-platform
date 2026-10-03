import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';
import {
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
  ASSET_TYPES,
  CAMPAIGN_STATUSES,
  MARKETING_CHANNELS,
} from '@/constants/projectTypes';
import { CAMPAIGN_STATUS_CLASS, channelClass } from './channel';
import './channel.css';
import './CampaignDetailDrawer.css';

const TASK_STATUS_CLASS = {
  ToDo: 'status-todo',
  InProgress: 'status-progress',
  Done: 'status-done',
  Cancelled: 'status-todo',
};

const TASK_STATUS_LABEL = { ToDo: 'To do', InProgress: 'In progress' };

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

  return createPortal(
    <div className="campaign-drawer__backdrop" onClick={onClose}>
      <aside
        className="campaign-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="campaign-drawer__head">
          <div className="campaign-drawer__head-meta">
            {campaign && (
              <span className={`mkt-ch-label ${channelClass(campaign.channel)}`}>
                {campaign.channel}
              </span>
            )}
            {campaign && (
              <span className={`status ${CAMPAIGN_STATUS_CLASS[campaign.status] ?? 'status-todo'}`}>
                {campaign.status}
              </span>
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
              <Field label="Goal">
                <p className="campaign-drawer__goal">{campaign.goalMd}</p>
              </Field>
            )}

            <section className="campaign-drawer__section">
              <div className="campaign-drawer__section-head">
                <h3 className="campaign-drawer__section-title">
                  Assets <span className="campaign-drawer__count">{detail.assets.length}</span>
                </h3>
                <span className="campaign-drawer__hint">
                  Draft → Review → Approved → Published
                </span>
              </div>
              <ul className="campaign-drawer__list">
                {detail.assets.map((a) => (
                  <li key={a.id} className="asset-row">
                    <div className="asset-row__main">
                      <div className="asset-row__title">{a.title}</div>
                      <div className="asset-row__meta">
                        <span>{a.type}</span>

                        <span>{fmtDate(a.publishDate)}</span>
                      </div>
                      {a.rejectionReason && a.status === 'Draft' && (
                        <div className="campaign-drawer__reason">
                          <strong>Rejected:</strong> {a.rejectionReason}
                        </div>
                      )}
                    </div>
                    <Select
                      aria-label={`Status of ${a.title}`}
                      value={a.status}
                      onChange={(e) => changeAssetStatus(a, e.target.value)}
                      options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm campaign-drawer__row-action"
                      onClick={() => deleteAsset(a)}
                      aria-label="Delete asset"
                      title="Delete asset"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {detail.assets.length === 0 && (
                  <li className="campaign-drawer__empty">No assets yet.</li>
                )}
              </ul>
              <CreateAssetInline
                campaignId={campaign.id}
                onCreated={async () => { await load(); onChanged?.(); }}
              />
            </section>

            <section className="campaign-drawer__section">
              <div className="campaign-drawer__section-head">
                <h3 className="campaign-drawer__section-title">
                  Tasks <span className="campaign-drawer__count">{detail.tasks.length}</span>
                </h3>
              </div>
              <ul className="campaign-drawer__list">
                {detail.tasks.map((t) => (
                  <li key={t.id} className={`mtask-row${t.status === 'Done' ? ' is-done' : ''}`}>
                    <input
                      type="checkbox"
                      className="cb"
                      checked={t.status === 'Done'}
                      onChange={() => toggleTask(t)}
                      aria-label={t.status === 'Done' ? 'Mark not done' : 'Mark done'}
                    />
                    <div className="asset-row__main">
                      <div className="mtask-row__title">{t.title}</div>
                      {t.assetTitle && (
                        <div className="asset-row__meta">→ {t.assetTitle}</div>
                      )}
                    </div>
                    <span className={`status ${TASK_STATUS_CLASS[t.status] ?? 'status-todo'}`}>
                      {TASK_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm campaign-drawer__row-action"
                      onClick={() => deleteTask(t)}
                      aria-label="Delete task"
                      title="Delete task"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {detail.tasks.length === 0 && (
                  <li className="campaign-drawer__empty">No tasks yet.</li>
                )}
              </ul>
              <CreateTaskInline
                campaignId={campaign.id}
                assets={detail.assets}
                onCreated={async () => { await load(); onChanged?.(); }}
              />
            </section>
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
      <div className="campaign-drawer__label">{label}</div>
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
        aria-label="New asset title"
      />
      <Select
        aria-label="Asset type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={ASSET_TYPES.map((t) => ({ value: t, label: t }))}
      />
      <Input
        type="date"
        aria-label="Publish date"
        value={publishDate}
        onChange={(e) => setPublishDate(e.target.value)}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={busy || !title.trim()}>
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
        aria-label="New task title"
      />
      <Select
        aria-label="Linked asset"
        value={assetId}
        onChange={(e) => setAssetId(e.target.value)}
        options={assetOptions}
      />
      <Button type="submit" variant="secondary" size="sm" disabled={busy || !title.trim()}>
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
          <h2 id="reject-asset-title" className="modal-title">Send back to Draft</h2>
        </ModalHeader>
        <ModalBody>
          <p className="campaign-drawer__lead">
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
