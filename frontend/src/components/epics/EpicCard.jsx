import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import './EpicCard.css';

export function EpicCard({ epic, orgSlug, projectSlug, onEdit }) {
  const pct =
    epic.totalStoryPoints > 0
      ? Math.round((epic.doneStoryPoints / epic.totalStoryPoints) * 100)
      : 0;
  const archived = Boolean(epic.archivedAt);

  return (
    <Card className={['epic-card', archived ? 'is-archived' : ''].filter(Boolean).join(' ')}>
      <div className="epic-card__head">
        <span className="epic-card__color" style={{ background: epic.color || 'var(--accent-primary)' }} />
        <div className="epic-card__title">
          <Link to={`/${orgSlug}/projects/${projectSlug}/epics/${epic.id}`}>
            {epic.title}
          </Link>
        </div>
        <Badge tone={statusTone(epic.status)}>{epic.status}</Badge>
        {onEdit && (
          <button
            type="button"
            className="epic-card__edit"
            onClick={() => onEdit(epic)}
            aria-label="Edit epic"
            title="Edit"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        )}
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
        <div className="epic-card__bar-fill" style={{ width: `${pct}%` }} />
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
