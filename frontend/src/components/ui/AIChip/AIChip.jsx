import { Sparkles } from 'lucide-react';
import './AIChip.css';

/**
 * Stratos AI badge — violet/cyan gradient pill used wherever the surface
 * is AI-generated or AI-driven. Variant "soft" gives a translucent fill
 * for inline use next to body text.
 */
export function AIChip({ label = 'AI', variant = 'gradient', className = '' }) {
  const classes = ['ai-chip', `ai-chip-${variant}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes}>
      <Sparkles size={12} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
