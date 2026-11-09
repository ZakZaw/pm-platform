import { Sparkles } from 'lucide-react';
import './AIChip.css';

/**
 * Iridescent AI pill — used wherever a surface is AI-generated or AI-driven.
 * Callers may still pass a legacy `variant` prop; it is ignored (not spread),
 * since the new design has a single canonical look.
 */
export function AIChip({ label = 'AI', className = '' }) {
  const classes = ['ai-chip', className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <span className="ai-chip-icon">
        <Sparkles size={9} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span>{label}</span>
    </span>
  );
}
