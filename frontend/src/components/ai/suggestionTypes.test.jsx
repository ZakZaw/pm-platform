import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { suggestionCategory, suggestionTypeMeta, SUGGESTION_TYPE_TONES } from './suggestionTypes';
import { SuggestionTypeBadge } from './SuggestionTypeBadge';
import { AISuggestionCard } from '@/components/ui';
import { PROJECT_TYPES } from '@/constants/projectTypes';

describe('suggestionTypes registry', () => {
  it('has a tone for every project type', () => {
    for (const t of PROJECT_TYPES) {
      expect(SUGGESTION_TYPE_TONES[t.id]).toBeTruthy();
    }
  });

  it('returns label, icon and tone for a type', () => {
    const meta = suggestionTypeMeta('Support');
    expect(meta.label).toBe('Support');
    expect(meta.tone).toBe('rose');
    expect(meta.icon).toBeTruthy();
  });

  it('falls back to the server category, else Other', () => {
    expect(suggestionCategory({ category: 'SLA' })).toBe('SLA');
    expect(suggestionCategory({})).toBe('Other');
  });
});

describe('type-aware suggestion card', () => {
  it('renders the type badge and tone class', () => {
    const { container } = render(
      <AISuggestionCard
        chipLabel="SLA"
        tone="rose"
        badge={<SuggestionTypeBadge projectType="Support" />}
        title="Ticket breached SLA"
      />,
    );
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(container.querySelector('.ai-suggest.ai-suggest-tone.is-rose')).not.toBeNull();
    expect(container.querySelector('.ai-type-badge.is-rose')).not.toBeNull();
  });

  it('omits the tone class when no tone is given', () => {
    const { container } = render(<AISuggestionCard title="Plain" />);
    expect(container.querySelector('.ai-suggest-tone')).toBeNull();
  });
});
