import { useState } from 'react';
import { Video, Zap } from 'lucide-react';
import {
  Avatar,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useToast,
} from '@/components/ui';
import { meetingsApi } from '@/api/meetings.api';
import './meetings.css';

/**
 * Start an instant meeting: name it, optionally invite a few project
 * members, and drop straight into the room. The meeting is created
 * InProgress and anchored to "now" server-side — no calendar slot.
 *
 * @param {object}   props
 * @param {object}   props.project   project the meeting belongs to
 * @param {Array}    props.members   project membership rows
 * @param {string}   props.meId      current user id (excluded from the invite list)
 * @param {Function} props.onClose   close the modal
 * @param {Function} props.onStarted called with the created meeting on success
 */
export function InstantMeetingModal({ project, members, meId, onClose, onStarted }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const invitable = members.filter((m) => m.userId !== meId);

  function togglePick(userId) {
    setPicked((cur) =>
      cur.includes(userId) ? cur.filter((id) => id !== userId) : [...cur, userId]);
  }

  async function start() {
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      toast.show({ tone: 'danger', message: 'Give the meeting a title first.' });
      return;
    }
    setBusy(true);
    try {
      const meeting = await meetingsApi.startInstant(project.id, {
        title: trimmed,
        type: 'Other',
        durationMinutes: 30,
        attendees: picked.map((userId) => ({ userId, required: true })),
      });
      toast.show({ tone: 'success', message: 'Meeting started.' });
      onStarted(meeting);
    } catch (err) {
      const msg = err.response?.data?.detail ?? 'Could not start the meeting.';
      toast.show({ tone: 'danger', message: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} labelledBy="instant-meeting-title" size="md">
      <ModalHeader>
        <h2 id="instant-meeting-title" className="row gap-2" style={{ margin: 0 }}>
          <Zap size={16} aria-hidden="true" /> Start an instant meeting
        </h2>
      </ModalHeader>
      <ModalBody>
        <Input
          label="Title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quick sync"
          maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
        />

        <div className="meeting-form-section" style={{ marginTop: 'var(--s-4)' }}>
          <h2>Invite members</h2>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
            You join automatically as organiser. Invitees get an email; you can
            also share a guest link once you're in the room.
          </p>
          <div className="meeting-attendees">
            {invitable.map((m) => {
              const isPicked = picked.includes(m.userId);
              return (
                <div
                  key={m.userId}
                  className={['meeting-attendee-row', isPicked && 'is-organiser']
                    .filter(Boolean).join(' ')}
                >
                  <Avatar src={m.avatarUrl} name={m.fullName || m.email} size="sm" />
                  <div className="meeting-attendee-meta">
                    <div className="meeting-attendee-name truncate">{m.fullName}</div>
                    <div className="meeting-attendee-mail truncate">{m.email}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={isPicked ? 'ghost' : 'secondary'}
                    onClick={() => togglePick(m.userId)}
                  >
                    {isPicked ? 'Remove' : 'Invite'}
                  </Button>
                </div>
              );
            })}
            {invitable.length === 0 && (
              <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
                No other members on this project yet — you can start solo and
                share a guest link from the room.
              </p>
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={start} disabled={busy}>
          <Video size={12} aria-hidden="true" />
          {busy ? ' Starting…' : ' Start meeting'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
