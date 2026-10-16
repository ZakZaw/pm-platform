import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import './TaskSection.css';

/**
 * Quiet collapsible section used for the secondary parts of the task
 * drawer (dependencies, fields, attachments, time). The header is a plain
 * sentence-case title + a muted summary (count / total) so a collapsed
 * section still tells you whether anything is inside.
 *
 * Children stay mounted while collapsed (hidden) so section state —
 * loaded data, pending inputs — survives toggling.
 */
export function TaskSection({ title, meta, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={['task-section', open ? 'is-open' : ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="task-section-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight size={14} aria-hidden="true" className="task-section-chevron" />
        <span className="task-section-title">{title}</span>
        {meta != null && meta !== '' && <span className="task-section-meta">{meta}</span>}
      </button>
      <div className="task-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
