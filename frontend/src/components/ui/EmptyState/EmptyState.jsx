import './EmptyState.css';

/**
 * Calm empty state. Shape: optional icon at the top, title, optional
 * one-line subtitle, optional primary action button (passed as children).
 *
 *   <EmptyState
 *     icon={<Sparkles size={20} />}
 *     title="No epics yet"
 *     subtitle="Group related tasks into epics to track progress."
 *   >
 *     <Button>Create an epic</Button>
 *   </EmptyState>
 */
export function EmptyState({ icon, title, subtitle, children, className = '' }) {
  return (
    <div className={['empty-state', className].filter(Boolean).join(' ')}>
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      {title && <p className="empty-state__title">{title}</p>}
      {subtitle && <p className="empty-state__subtitle">{subtitle}</p>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  );
}
