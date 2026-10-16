import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coffee, Eye, HelpCircle, Sparkles } from 'lucide-react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { pokerApi } from '@/api/poker.api';
import { useAuthStore } from '@/store/authStore';
import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import './PlanningPokerModal.css';

const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'];

function CardFace({ value }) {
  if (value === '?') return <HelpCircle size={18} aria-hidden="true" />;
  if (value === 'coffee') return <Coffee size={18} aria-hidden="true" />;
  return <span>{value}</span>;
}

export function PlanningPokerModal({ open, task, projectId, onClose, onClosedWithEstimate }) {
  const toast = useToast();
  const me = useAuthStore((s) => s.user);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const taskId = task?.id;
  const refetch = useCallback(async () => {
    if (!taskId) return;
    try {
      const next = await pokerApi.getActive(taskId);
      setSession(next ?? null);
    } catch {
      /* silent — UI shows last known state */
    }
  }, [taskId]);

  // Live updates while the modal is open. Refetch on any poker event for the
  // task — server broadcasts to the project group, so we filter client-side
  // by checking the session id we already hold.
  const sessionId = session?.id;
  useProjectRealtime(open ? projectId : null, {
    'poker.started': () => refetch(),
    'poker.vote_cast': (p) => { if (!sessionId || p?.sessionId === sessionId) refetch(); },
    'poker.revealed': (p) => { if (!sessionId || p?.sessionId === sessionId) refetch(); },
    'poker.closed': (p) => { if (!sessionId || p?.sessionId === sessionId) refetch(); },
  });

  // Enter the loading state during render when the modal opens for a task;
  // the effect below only performs the fetch.
  const loadKey = open && taskId ? taskId : null;
  const [prevLoadKey, setPrevLoadKey] = useState(null);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    if (loadKey) setLoading(true);
  }

  useEffect(() => {
    if (!open || !taskId) return;
    pokerApi.getActive(taskId)
      .then((s) => setSession(s ?? null))
      .catch((err) =>
        toast.show({
          tone: 'danger',
          message: err.response?.data?.detail ?? 'Could not load session.',
        }))
      .finally(() => setLoading(false));
  }, [open, taskId, toast]);

  const myVote = useMemo(
    () => session?.votes?.find((v) => v.userId === me?.id) ?? null,
    [session, me?.id],
  );
  const isHost = session?.hostUserId === me?.id;
  const isRevealed = session?.status === 'Revealed';
  const isClosed = session?.status === 'Closed';

  async function start() {
    setBusy(true);
    try {
      const created = await pokerApi.start(task.id);
      setSession(created);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not start session.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function vote(value) {
    if (isRevealed || isClosed) return;
    setBusy(true);
    try {
      const updated = await pokerApi.vote(session.id, value);
      setSession(updated);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not record vote.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    setBusy(true);
    try {
      const updated = await pokerApi.reveal(session.id);
      setSession(updated);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not reveal.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function close({ apply }) {
    if (!session) return;
    const finalEstimate = apply && session.median != null ? session.median : null;
    setBusy(true);
    try {
      const updated = await pokerApi.close(session.id, {
        finalEstimate,
        applyToTask: apply,
      });
      setSession(updated);
      if (apply && finalEstimate != null) {
        onClosedWithEstimate?.(finalEstimate);
        toast.show({ tone: 'success', message: `Estimate set to ${finalEstimate}.` });
      } else {
        toast.show({ tone: 'success', message: 'Session closed.' });
      }
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not close session.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="poker-title" size="lg">
      <ModalHeader>
        <h3 id="poker-title" className="modal-title">
          <Sparkles size={14} aria-hidden="true" className="poker-title-icon" />
          Planning poker
        </h3>
      </ModalHeader>
      <ModalBody>
        {loading ? (
          <Skeleton height={180} />
        ) : !session ? (
          <div className="poker-empty">
            <p className="muted">
              Start a round to estimate this task as a group. Members drop
              hidden votes; you reveal to compare.
            </p>
            <Button variant="primary" onClick={start} disabled={busy}>
              {busy ? 'Starting…' : 'Start round'}
            </Button>
          </div>
        ) : (
          <div className="poker">
            <div className="poker-cards">
              {CARDS.map((c) => {
                const isMine = myVote?.value === c;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`poker-card ${isMine ? 'is-mine' : ''}`}
                    onClick={() => vote(c)}
                    disabled={busy || isRevealed || isClosed}
                    aria-pressed={isMine}
                  >
                    <CardFace value={c} />
                  </button>
                );
              })}
            </div>

            <div className="eyebrow poker-voters-head">
              {isRevealed ? 'Votes' : `Voted (${session.votes.length})`}
              {isRevealed && session.average != null && (
                <span className="muted">
                  avg {session.average} · median {session.median ?? '—'}
                </span>
              )}
            </div>
            <ul className="poker-voters">
              {session.votes.length === 0 ? (
                <li className="muted poker-voter-empty">No votes yet.</li>
              ) : (
                session.votes.map((v) => (
                  <li key={v.userId} className="poker-voter">
                    <span className="truncate">{v.userName ?? '—'}</span>
                    <span className={`poker-voter-card ${isRevealed ? 'is-shown' : ''}`}>
                      {isRevealed ? <CardFace value={v.value ?? '—'} /> : '✓'}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Close window</Button>
        {session && !isClosed && (
          <>
            {!isRevealed && isHost && (
              <Button onClick={reveal} disabled={busy || session.votes.length === 0}>
                <Eye size={12} aria-hidden="true" /> Reveal
              </Button>
            )}
            {isRevealed && isHost && (
              <>
                <Button variant="ghost" onClick={() => close({ apply: false })} disabled={busy}>
                  End without applying
                </Button>
                <Button
                  variant="primary"
                  onClick={() => close({ apply: true })}
                  disabled={busy || session.median == null}
                >
                  Apply median ({session.median ?? '—'})
                </Button>
              </>
            )}
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
