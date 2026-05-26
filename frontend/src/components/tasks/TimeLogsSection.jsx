import { useCallback, useEffect, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { timeLogsApi } from '@/api/timeLogs.api';
import './TimeLogsSection.css';

const HOURS_DECIMAL = /^(\d+)(?:\.(\d+))?$/;
const H_M_PATTERN = /^(\d+)h(?:\s*(\d+)m)?$|^(\d+)m$/i;

function parseDuration(raw) {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return null;
  const hm = v.match(H_M_PATTERN);
  if (hm) {
    if (hm[3]) return parseInt(hm[3], 10);
    const h = parseInt(hm[1], 10);
    const m = hm[2] ? parseInt(hm[2], 10) : 0;
    return h * 60 + m;
  }
  const dec = v.match(HOURS_DECIMAL);
  if (dec) {
    const num = parseFloat(v);
    if (Number.isNaN(num)) return null;
    return Math.round(num * 60);
  }
  return null;
}

function formatMinutes(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TimeLogsSection({ taskId, totalMinutes = 0, onLogged }) {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await timeLogsApi.list(taskId);
      setEntries(list);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not load time logs.',
      });
    }
  }, [taskId, toast]);

  useEffect(() => {
    if (taskId) reload();
  }, [taskId, reload]);

  async function submit(e) {
    e.preventDefault();
    const minutes = parseDuration(draft);
    if (minutes == null || minutes < 1 || minutes > 1440) {
      toast.show({
        tone: 'danger',
        message: 'Use "1h", "45m", "1h 30m", or "1.5" — up to one day.',
      });
      return;
    }
    setBusy(true);
    try {
      const loggedAt = date ? new Date(`${date}T12:00:00Z`).toISOString() : null;
      const created = await timeLogsApi.log(taskId, {
        minutes,
        loggedAt,
        comment: comment.trim() || null,
      });
      setEntries((cur) => [created, ...cur]);
      setDraft('');
      setComment('');
      onLogged?.(minutes);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not log time.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry) {
    try {
      await timeLogsApi.remove(entry.id);
      setEntries((cur) => cur.filter((e) => e.id !== entry.id));
      onLogged?.(-entry.minutes);
    } catch (err) {
      toast.show({
        tone: 'danger',
        message: err.response?.data?.detail ?? 'Could not delete entry.',
      });
    }
  }

  return (
    <div className="timelogs-section">
      <div className="eyebrow timelogs-section__head">
        <Clock size={11} aria-hidden="true" /> Time logged
        <span className="muted">{formatMinutes(totalMinutes)} total</span>
      </div>

      <form onSubmit={submit} className="timelogs-section__form">
        <input
          type="text"
          className="input timelogs-section__duration"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 1h 30m"
          aria-label="Duration"
        />
        <input
          type="date"
          className="input timelogs-section__date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
        />
        <input
          type="text"
          className="input fill"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Comment (optional)"
          aria-label="Comment"
          maxLength={500}
        />
        <Button size="sm" type="submit" disabled={!draft.trim() || busy}>
          {busy ? '…' : 'Log'}
        </Button>
      </form>

      {entries.length > 0 && (
        <ul className="timelogs-section__list">
          {entries.map((e) => (
            <li key={e.id} className="timelogs-section__row">
              <span className="timelogs-section__minutes">{formatMinutes(e.minutes)}</span>
              <span className="muted timelogs-section__date">{formatDate(e.loggedAt)}</span>
              <span className="timelogs-section__who muted">{e.userName ?? '—'}</span>
              {e.comment && <span className="fill truncate" title={e.comment}>{e.comment}</span>}
              {!e.comment && <span className="fill" />}
              <button
                type="button"
                className="btn btn-ghost btn-icon-sm"
                onClick={() => remove(e)}
                aria-label="Delete entry"
              >
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
