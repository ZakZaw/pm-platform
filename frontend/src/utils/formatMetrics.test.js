import { describe, expect, it } from 'vitest';
import {
  DASH,
  deltaClass,
  formatCompactMoney,
  formatNumber,
  formatPct,
  formatSigned,
} from './formatMetrics';
import { describeActivity } from './activityFormat';

describe('formatMetrics', () => {
  it('formats compact money', () => {
    expect(formatCompactMoney(1_260_000, 'USD')).toBe('$1.3M');
    expect(formatCompactMoney(0, 'USD')).toBe('$0');
  });

  it('renders a dash for missing numbers instead of NaN', () => {
    expect(formatCompactMoney(undefined)).toBe(DASH);
    expect(formatNumber(null)).toBe(DASH);
    expect(formatNumber(Number.NaN)).toBe(DASH);
    expect(formatPct(null)).toBe(DASH);
  });

  it('formats numbers with at most one decimal', () => {
    expect(formatNumber(2.84, { suffix: 'd' })).toBe('2.8d');
    expect(formatNumber(38)).toBe('38');
  });

  it('signs deltas and hides missing ones', () => {
    expect(formatSigned(12)).toBe('+12');
    expect(formatSigned(-0.4, 'd')).toBe('−0.4d');
    expect(formatSigned(0, '%')).toBe('±0%');
    expect(formatSigned(null)).toBeNull();
  });

  it('maps good/bad news to the stat-delta classes', () => {
    expect(deltaClass(true)).toBe('stat-delta-up');
    expect(deltaClass(false)).toBe('stat-delta-down');
  });

  it('rounds percentages', () => {
    expect(formatPct(94.4)).toBe('94%');
  });
});

describe('describeActivity', () => {
  it('prefers the recorder summary', () => {
    expect(describeActivity({ verb: 'EpicDatesChanged', targetType: 'Epic', summary: ' moved Auth to Q3 ' }))
      .toBe('moved Auth to Q3');
  });

  it('falls back to verb + target', () => {
    expect(describeActivity({ verb: 'CommentAdded', targetType: 'Task' })).toBe('commented on the task');
    expect(describeActivity({ verb: 'Unknown', targetType: 'Thing' })).toBe('Unknown the thing');
  });
});
