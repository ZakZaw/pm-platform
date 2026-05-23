import { useNavigate } from 'react-router-dom';
import { Badge, Card } from '@/components/ui';
import './EpicCard.css';

export function EpicCard({ epic, orgSlug, projectSlug }) {
  const navigate = useNavigate();
  const pct =
    epic.totalStoryPoints > 0
      ? Math.round((epic.doneStoryPoints / epic.totalStoryPoints) * 100)
      : 0;
  const archived = Boolean(epic.archivedAt);
  const detailHref = `/${orgSlug}/projects/${projectSlug}/epics/${epic.id}`;

  function open() {
    navigate(detailHref);
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  }

  return (
    <Card
      className={['epic-card', 'is-interactive', archived ? 'is-archived' : ''].filter(Boolean).join(' ')}
    >
      <div
        className="epic-card__hit"
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={onKey}
        aria-label={`Open epic ${epic.title}`}
      />
      <div className="epic-card__head">
        <span className="epic-card__color" style={{ background: epic.color || 'var(--accent)' }} />
        <div className="epic-card__title">{epic.title}</div>
        <Badge tone={statusTone(epic.status)}>{epic.status}</Badge>
      </div>

      {epic.description && (
        <p className="epic-card__desc">{epic.description}</p>
      )}

      <div className="epic-card__meta">
        <span>{epic.taskCount} {epic.taskCount === 1 ? 'task' : 'tasks'}</span>
        <span>·</span>
        <span>{epic.doneStoryPoints}/{epic.totalStoryPoints} pts</span>
      </div>

      <div className="epic-card__bar" aria-label={`Progress ${pct}%`}>
        <div
          className="epic-card__bar-fill"
          style={{ width: `${pct}%`, background: epic.color || 'var(--accent)' }}
        />
      </div>
    </Card>
  );
}

function statusTone(status) {
  switch (status) {
    case 'Planning': return 'neutral';
    case 'InProgress': return 'info';
    case 'Done': return 'success';
    case 'Archived': return 'neutral';
    default: return 'neutral';
  }
}
