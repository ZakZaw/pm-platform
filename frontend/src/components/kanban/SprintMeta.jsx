import { Sparkline } from '@/components/ui';
import './SprintMeta.css';

/**
 * One quiet line of sprint facts under a board title:
 * burndown sparkline · done / total pts · days left · date range.
 * Every item is optional; renders nothing when there is nothing to say.
 */
export function SprintMeta({ burnPoints, donePts = 0, totalPts = 0, daysLeft = null, range = null }) {
  const items = [];
  if (burnPoints) {
    items.push(
      <span key="burn" className="sprint-meta-item" title="Burndown">
        <Sparkline points={burnPoints} width={72} height={18} ideal />
      </span>,
    );
  }
  if (totalPts > 0) {
    items.push(
      <span key="pts" className="sprint-meta-item">
        <span><strong>{donePts}</strong> / {totalPts} pts done</span>
      </span>,
    );
  }
  if (daysLeft != null) {
    items.push(
      <span
        key="days"
        className={['sprint-meta-item', daysLeft <= 3 ? 'is-warning' : ''].filter(Boolean).join(' ')}
      >
        {daysLeft} day{daysLeft === 1 ? '' : 's'} left
      </span>,
    );
  }
  if (range) {
    items.push(<span key="range" className="sprint-meta-item">{range}</span>);
  }
  if (items.length === 0) return null;
  return <div className="sprint-meta">{items}</div>;
}
