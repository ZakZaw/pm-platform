import { describe, expect, it } from 'vitest';
import { mapTimeline, toneColor } from './timeline';
import { ROADMAP_ADAPTERS, adapterForType } from '../roadmapRegistry';
import { engineeringRoadmap } from './engineering';
import { timelineRoadmap } from './timeline';

describe('toneColor', () => {
  it('maps semantic tones to design tokens', () => {
    expect(toneColor('danger')).toBe('var(--danger)');
    expect(toneColor('accent')).toBe('var(--accent)');
    expect(toneColor('neutral')).toBe('var(--text-muted)');
    expect(toneColor(null)).toBe('var(--text-muted)');
  });

  it('maps marketing channel tones to channel tokens', () => {
    expect(toneColor('mkt-email')).toBe('var(--mkt-channel-email)');
  });
});

describe('mapTimeline', () => {
  const payload = {
    projectId: 'p1',
    type: 'Support',
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-30T00:00:00Z',
    groups: [
      { id: 'q1', label: 'Billing', sublabel: '2 open · SLA 1d' },
      { id: 'q2', label: 'Bugs', sublabel: '0 open · SLA 1d' },
    ],
    bars: [],
    markers: [
      { id: 't1', label: 'Refund', at: '2026-10-10T00:00:00Z', tone: 'danger', kind: 'sla', sublabel: 'High', groupId: 'q1', flagged: true },
      { id: 't2', label: 'Invoice', at: '2026-10-20T00:00:00Z', tone: 'info', kind: 'sla', sublabel: 'Low', groupId: 'q1', flagged: false },
      { id: 'm', label: 'Loose', at: '2026-10-21T00:00:00Z', tone: 'accent', kind: 'milestone', groupId: null, flagged: false },
    ],
    stats: [{ label: 'SLA breached', value: '1', tone: 'danger' }],
    undated: [],
    emptyHint: 'Support work is a queue',
  };

  it('puts markers into their group lanes and keeps ungrouped ones separate', () => {
    const vm = mapTimeline(payload);
    expect(vm.type).toBe('Support');
    expect(vm.groups).toHaveLength(2);
    expect(vm.groups[0].points.map((p) => p.id)).toEqual(['t1', 't2']);
    expect(vm.groups[1].points).toEqual([]);
    expect(vm.points.map((p) => p.id)).toEqual(['m']);
  });

  it('carries flags, tones and a read-only capability set', () => {
    const vm = mapTimeline(payload);
    const breached = vm.groups[0].points[0];
    expect(breached.flagged).toBe(true);
    expect(breached.color).toBe('var(--danger)');
    expect(vm.editable).toBe(false);
    expect(vm.capabilities).toEqual({ milestones: false, share: false });
    expect(vm.stats).toEqual([{ label: 'SLA breached', value: '1', tone: 'danger' }]);
    expect(vm.range).toEqual({ from: payload.from, to: payload.to });
  });

  it('maps marker kinds to RoadmapView point shapes', () => {
    const vm = mapTimeline({
      ...payload,
      type: 'Sales',
      groups: [{ id: 's', label: 'Qualify' }],
      markers: [{ id: 'd', label: 'Acme', at: payload.from, tone: 'info', kind: 'deal', groupId: 's' }],
      undated: [{ id: 'u', label: 'No date deal' }],
    });
    expect(vm.groups[0].points[0].kind).toBe('target');
    expect(vm.undated).toEqual([{ id: 'u', title: 'No date deal' }]);
    expect(vm.undatedTitle).toBe('No expected close date');
  });
});

describe('roadmapRegistry', () => {
  it('keeps the editable adapter for engineering and the server timeline for every other type', () => {
    expect(ROADMAP_ADAPTERS.Engineering).toBe(engineeringRoadmap);
    for (const t of ['Sales', 'Support', 'Marketing', 'Operations', 'Generic']) {
      expect(adapterForType(t)).toBe(timelineRoadmap);
    }
  });

  it('falls back to the server timeline for unknown types', () => {
    expect(adapterForType('FutureType')).toBe(timelineRoadmap);
  });
});
