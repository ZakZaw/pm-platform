import './LiveIndicator.css';

const LABEL = {
  idle: 'Idle',
  connecting: 'Connecting…',
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  failed: 'Offline',
};

/**
 * Quiet dot + text read-out of the SignalR connection state. Lets users
 * notice when real-time updates are down (in which case they should hit
 * Refresh to see other people's changes).
 */
export function LiveIndicator({ status }) {
  const label = LABEL[status] ?? status;
  return (
    <span
      className={['live-indicator', `is-${status}`].join(' ')}
      title={status === 'failed' ? 'Real-time updates are off — use Refresh.' : label}
    >
      <span className="live-indicator-dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
