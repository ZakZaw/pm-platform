import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Lock, SkipForward } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { operationsApi } from '@/api/operations.api';
import './RunDetailPage.css';

const TERMINAL = new Set(['Completed', 'Skipped']);

function statusTone(status) {
  switch (status) {
    case 'Completed': return 'success';
    case 'InProgress': return 'info';
    case 'Skipped': return 'neutral';
    default: return 'warning';
  }
}

export function RunDetailPage() {
  const { slug: orgSlug, projectSlug, runId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [skipping, setSkipping] = useState(false);

  async function refresh() {
    const d = await operationsApi.getRun(runId);
    setData(d);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await refresh(); }
      catch (err) {
        if (!cancelled) setError(err.response?.data?.detail ?? 'Could not load run.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  async function toggle(item, next) {
    // Block sequential out-of-order ticks on the client too so the user
    // sees instant feedback. The server still enforces it as the source
    // of truth.
    if (next && item.sequential) {
      const earlierIncomplete = data.items.some(
        (i) => i.order < item.order && !i.completed,
      );
      if (earlierIncomplete) {
        toast.show({ tone: 'danger', message: 'Complete earlier sequential items first.' });
        return;
      }
    }
    try {
      await operationsApi.toggleItem(item.id, next);
      await refresh();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not update item.' });
    }
  }

  async function startRun() {
    try {
      await operationsApi.startRun(runId);
      await refresh();
    } catch (err) {
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not start run.' });
    }
  }

  if (error) return <div className="page"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!data) {
    return (
      <div className="page" aria-busy="true">
        <Skeleton width="50%" height={20} />
        <div style={{ height: 12 }} />
        <Skeleton rows={5} />
      </div>
    );
  }

  const { run, items } = data;
  const terminal = TERMINAL.has(run.status);
  const allDone = items.length > 0 && items.every((i) => i.completed);

  return (
    <div className="page run-detail-page">
      <div className="run-detail-page__back">
        <Link to={`/${orgSlug}/projects/${projectSlug}/runbooks`} className="muted">
          <ArrowLeft size={13} aria-hidden="true" /> Runbooks
        </Link>
      </div>

      <header className="page-header">
        <div>
          <h1 className="page-title">{run.workflowName}</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Scheduled for{' '}
            {new Date(run.scheduledFor).toLocaleString(undefined, {
              dateStyle: 'medium', timeStyle: 'short',
            })}
            {run.isOverdue && (
              <Badge tone="danger" style={{ marginLeft: 8 }}>Overdue</Badge>
            )}
          </div>
        </div>
        <div className="hstack" style={{ gap: 8 }}>
          <Badge tone={statusTone(run.status)}>{run.status}</Badge>
          {!terminal && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSkipping(true)}
            >
              <SkipForward size={13} aria-hidden="true" /> Skip
            </Button>
          )}
          {!terminal && run.status === 'Pending' && (
            <Button size="sm" onClick={startRun}>Start</Button>
          )}
        </div>
      </header>

      {run.status === 'Skipped' && run.skippedReason && (
        <Card className="run-detail-page__skipped">
          <strong>Skipped:</strong> {run.skippedReason}
        </Card>
      )}

      <Card className="run-detail-page__checklist">
        {items.length === 0 ? (
          <p className="muted">This run has no checklist items.</p>
        ) : (
          <ul className="vstack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 4 }}>
            {items.map((item) => {
              const earlierIncomplete = item.sequential && items.some(
                (i) => i.order < item.order && !i.completed,
              );
              const locked = (!item.completed && earlierIncomplete) || terminal;
              return (
                <li key={item.id} className="run-detail-page__item">
                  <button
                    type="button"
                    className={[
                      'run-detail-page__check',
                      item.completed ? 'is-checked' : '',
                      locked ? 'is-locked' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => !locked && toggle(item, !item.completed)}
                    disabled={locked}
                    aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {item.completed
                      ? <CheckCircle2 size={16} aria-hidden="true" />
                      : locked
                        ? <Lock size={14} aria-hidden="true" />
                        : <Circle size={16} aria-hidden="true" />}
                  </button>
                  <span
                    className={[
                      'run-detail-page__item-title',
                      item.completed ? 'is-completed' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {item.title}
                  </span>
                  {item.sequential && (
                    <Badge tone="neutral">Sequential</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {allDone && run.status === 'Completed' && (
          <p className="muted" style={{ marginTop: 12 }}>
            Completed{' '}
            {run.completedAt && new Date(run.completedAt).toLocaleString(undefined, {
              dateStyle: 'medium', timeStyle: 'short',
            })}
            .
          </p>
        )}
      </Card>

      {skipping && (
        <SkipModal
          onClose={() => setSkipping(false)}
          onConfirm={async (reason) => {
            try {
              await operationsApi.skipRun(runId, reason);
              setSkipping(false);
              await refresh();
              toast.show({ tone: 'success', message: 'Run skipped.' });
            } catch (err) {
              toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not skip run.' });
            }
          }}
        />
      )}
    </div>
  );
}

function SkipModal({ onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={busy ? undefined : onClose} labelledBy="skip-title" size="sm">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason.trim()) return;
          setBusy(true);
          try { await onConfirm(reason.trim()); }
          finally { setBusy(false); }
        }}
      >
        <ModalHeader>
          <h2 id="skip-title" style={{ margin: 0, fontSize: 16 }}>Skip this run</h2>
        </ModalHeader>
        <ModalBody>
          <Input
            label="Reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            placeholder="Why is this run being skipped?"
          />
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>
            {busy ? 'Skipping…' : 'Skip run'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
