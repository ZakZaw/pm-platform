import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Lock, SkipForward } from 'lucide-react';
import {
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

// Run status read-out as dot + coloured text (stratos .status-*).
function statusClass(status) {
  switch (status) {
    case 'Completed': return 'status-done';
    case 'InProgress': return 'status-progress';
    case 'Skipped': return 'status-todo';
    default: return 'status-review';
  }
}

const STATUS_LABEL = { InProgress: 'In progress' };

export function RunDetailPage() {
  const { slug: orgSlug, projectSlug, runId } = useParams();
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

  if (error) return <div className="main-inner"><p className="muted">{error}</p></div>;
  if (!data) {
    return (
      <div className="main-inner run-detail-page" aria-busy="true">
        <div className="page-head">
          <Skeleton width="50%" height={28} />
        </div>
        <Skeleton rows={5} />
      </div>
    );
  }

  const { run, items } = data;
  const terminal = TERMINAL.has(run.status);
  const allDone = items.length > 0 && items.every((i) => i.completed);
  const doneCount = items.filter((i) => i.completed).length;

  return (
    <div className="main-inner run-detail-page">
      <div className="page-head">
        <Link to={`/${orgSlug}/projects/${projectSlug}/runbooks`} className="run-detail-page-back-link">
          <ArrowLeft size={13} aria-hidden="true" /> Runbooks
        </Link>
        <div className="page-title-row">
          <div>
            <h1 className="page-title">{run.workflowName}</h1>
            <p className="page-subtitle">
              Scheduled for{' '}
              {new Date(run.scheduledFor).toLocaleString(undefined, {
                dateStyle: 'medium', timeStyle: 'short',
              })}
              {run.isOverdue && <> · <span className="run-detail-page-overdue">Overdue</span></>}
            </p>
          </div>
          <div className="row gap-4">
            <span className={`status ${statusClass(run.status)}`}>
              {STATUS_LABEL[run.status] ?? run.status}
            </span>
            {!terminal && (
              <Button variant="ghost" size="sm" onClick={() => setSkipping(true)}>
                <SkipForward size={13} aria-hidden="true" /> Skip
              </Button>
            )}
            {!terminal && run.status === 'Pending' && (
              <Button variant="primary" size="sm" onClick={startRun}>Start</Button>
            )}
          </div>
        </div>
      </div>

      {run.status === 'Skipped' && run.skippedReason && (
        <Card className="run-detail-page-skipped">
          <strong>Skipped:</strong> {run.skippedReason}
        </Card>
      )}

      <Card className="run-detail-page-checklist">
        {items.length > 0 && (
          <div className="run-detail-page-progress">
            <div className="run-detail-page-progress-label">
              <span className="h-card">Checklist</span>
              <span className="muted">{doneCount} of {items.length} done</span>
            </div>
            <div className="bar">
              <div
                className="bar-fill bar-fill-success"
                style={{ width: `${Math.round((doneCount / items.length) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <p className="muted">This run has no checklist items.</p>
        ) : (
          <ul className="run-detail-page-items">
            {items.map((item) => {
              const earlierIncomplete = item.sequential && items.some(
                (i) => i.order < item.order && !i.completed,
              );
              const locked = (!item.completed && earlierIncomplete) || terminal;
              return (
                <li key={item.id} className="run-detail-page-item">
                  <button
                    type="button"
                    className={[
                      'run-detail-page-check',
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
                      'run-detail-page-item-title',
                      item.completed ? 'is-completed' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {item.title}
                  </span>
                  {item.sequential && (
                    <span className="run-detail-page-seq">Sequential</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {allDone && run.status === 'Completed' && (
          <p className="muted run-detail-page-done-note">
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
          <h2 id="skip-title" className="modal-title">Skip this run</h2>
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
