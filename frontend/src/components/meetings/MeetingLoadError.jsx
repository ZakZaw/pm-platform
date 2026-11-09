import { useNavigate } from 'react-router-dom';
import { CalendarX2 } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';

/**
 * Shown when a meeting page can't load its meeting. 400/403/404 read as
 * "not found" (a bad link, or a meeting in a project you can't see — the
 * API doesn't distinguish, and neither do we); anything else offers a retry.
 *
 * @param {{ error: unknown, meetingsPath: string, onRetry?: () => void }} props
 */
export function MeetingLoadError({ error, meetingsPath, onRetry }) {
  const navigate = useNavigate();
  const status = /** @type {any} */ (error)?.response?.status;
  const missing = status === 400 || status === 403 || status === 404;

  return (
    <div className="main-inner">
      <EmptyState
        icon={<CalendarX2 size={20} />}
        title={missing ? 'Meeting not found' : "Couldn't load this meeting"}
        subtitle={missing
          ? 'The link may be wrong, or the meeting was cancelled or is in a project you can’t access.'
          : 'Check your connection and try again.'}
      >
        {!missing && onRetry && <Button onClick={onRetry}>Try again</Button>}
        <Button variant={missing ? 'primary' : 'ghost'} onClick={() => navigate(meetingsPath)}>
          Back to meetings
        </Button>
      </EmptyState>
    </div>
  );
}
