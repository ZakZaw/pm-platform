import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity as ActivityIcon, Mail, MessageSquare, Phone, Video, X } from 'lucide-react';
import { Badge, Button, Input, Select, useToast } from '@/components/ui';
import { salesApi } from '@/api/sales.api';
import { LostReasonModal } from './LostReasonModal';
import './DealDetailDrawer.css';

const ACTIVITY_ICONS = {
  Note: MessageSquare,
  Call: Phone,
  Email: Mail,
  Meeting: Video,
  Task: ActivityIcon,
};

function fmtCurrency(value, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value ?? 0);
  } catch {
    return `${currency} ${value}`;
  }
}

export function DealDetailDrawer({ dealId, stages, onClose, onChanged }) {
  const toast = useToast();
  const [deal, setDeal] = useState(null);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingLost, setPendingLost] = useState(null);
  const [activityType, setActivityType] = useState('Note');
  const [activitySummary, setActivitySummary] = useState('');

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    (async () => {
      try {
        const [d, acts] = await Promise.all([
          salesApi.getDeal(dealId),
          salesApi.listActivities(dealId),
        ]);
        if (cancelled) return;
        setDeal(d);
        setActivities(acts);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load deal.');
      }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function changeStage(toStageId) {
    if (!deal) return;
    const toStage = stages.find((s) => s.id === toStageId);
    if (!toStage || toStage.id === deal.stageId) return;
    if (toStage.isTerminalLost) {
      setPendingLost(toStage);
      return;
    }
    await applyStageChange(toStage.id, null);
  }

  async function applyStageChange(toStageId, reason) {
    setSaving(true);
    try {
      const updated = await salesApi.changeDealStage(deal.id, { toStageId, reason });
      setDeal(updated);
      onChanged?.();
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not change stage',
        message: err.response?.data?.detail ?? 'Server rejected the change.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function patchDeal(patch) {
    if (!deal) return;
    setSaving(true);
    try {
      const updated = await salesApi.updateDeal(deal.id, patch);
      setDeal(updated);
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

  async function logActivity(e) {
    e.preventDefault();
    if (!activitySummary.trim()) return;
    try {
      const created = await salesApi.createActivity(deal.id, {
        type: activityType,
        summary: activitySummary.trim(),
      });
      setActivities([created, ...activities]);
      setActivitySummary('');
    } catch (err) {
      toast.show({
        tone: 'danger',
        title: 'Could not log activity',
        message: err.response?.data?.detail ?? 'Server rejected the request.',
      });
    }
  }

  return createPortal(
    <div className="deal-drawer__backdrop" onClick={onClose}>
      <aside
        className="deal-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="deal-drawer__head">
          <div className="hstack" style={{ gap: 8 }}>
            <Badge tone={deal?.status === 'Won' ? 'success' : deal?.status === 'Lost' ? 'danger' : 'info'}>
              {deal?.status ?? '…'}
            </Badge>
            <span className="muted" style={{ fontSize: 12 }}>
              {deal?.accountName}
            </span>
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

        {error && <p className="deal-drawer__error">{error}</p>}
        {!deal && !error && <p className="deal-drawer__placeholder">Loading…</p>}

        {deal && (
          <div className="deal-drawer__body">
            <h2 className="deal-drawer__title">{deal.name}</h2>

            <div className="grid-2 deal-drawer__fields">
              <Field label="Value">
                <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                  {fmtCurrency(deal.value, deal.currency)}
                </span>
              </Field>
              <Field label="Stage">
                <Select
                  value={deal.stageId}
                  onChange={(e) => changeStage(e.target.value)}
                  disabled={saving}
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Field>
              <Field label="Probability">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={deal.probability}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) setDeal({ ...deal, probability: v });
                  }}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v !== deal.probability) {
                      patchDeal({ probability: v });
                    }
                  }}
                />
              </Field>
              <Field label="Expected close">
                <Input
                  type="date"
                  value={deal.expectedClose ? deal.expectedClose.slice(0, 10) : ''}
                  onChange={(e) => patchDeal({ expectedClose: e.target.value || null })}
                />
              </Field>
            </div>

            {deal.lostReason && (
              <div className="deal-drawer__reason">
                <strong>Lost reason:</strong> {deal.lostReason}
              </div>
            )}
            {deal.wonNote && (
              <div className="deal-drawer__reason deal-drawer__reason--won">
                <strong>Won note:</strong> {deal.wonNote}
              </div>
            )}

            <div className="subsection">
              <div className="subsection-eyebrow">Activity</div>
              <form className="deal-drawer__activity-form" onSubmit={logActivity}>
                <Select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  options={[
                    { value: 'Note', label: 'Note' },
                    { value: 'Call', label: 'Call' },
                    { value: 'Email', label: 'Email' },
                    { value: 'Meeting', label: 'Meeting' },
                    { value: 'Task', label: 'Task' },
                  ]}
                />
                <Input
                  value={activitySummary}
                  onChange={(e) => setActivitySummary(e.target.value)}
                  placeholder="Log a touchpoint…"
                />
                <Button type="submit" size="sm" disabled={!activitySummary.trim()}>
                  Log
                </Button>
              </form>

              <ul className="deal-drawer__activity-list">
                {activities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? MessageSquare;
                  return (
                    <li key={a.id} className="deal-drawer__activity">
                      <Icon size={13} aria-hidden="true" />
                      <div className="grow">
                        <div>{a.summary}</div>
                        <div className="muted" style={{ fontSize: 11 }}>
                          {a.type} · {new Date(a.occurredAt).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {activities.length === 0 && (
                  <li className="muted" style={{ padding: 12 }}>No activity yet.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {pendingLost && (
          <LostReasonModal
            deal={deal}
            toStage={pendingLost}
            onCancel={() => setPendingLost(null)}
            onConfirm={async (reason) => {
              const stageId = pendingLost.id;
              setPendingLost(null);
              await applyStageChange(stageId, reason);
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
    <div className="deal-drawer__field">
      <div className="subsection-eyebrow">{label}</div>
      {children}
    </div>
  );
}
