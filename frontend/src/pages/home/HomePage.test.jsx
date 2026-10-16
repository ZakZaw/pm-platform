import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildHomeKpis } from './homeKpis';

vi.mock('@/api/analytics.api', () => ({
  analyticsApi: { myHome: vi.fn() },
}));

const { analyticsApi } = await import('@/api/analytics.api');
const { HomePage } = await import('./HomePage');

const EMPTY_HOME = {
  kpis: {
    completed30: 0, completedDelta: null, avgCycleDays: null, avgCycleDeltaDays: null,
    streakDays: 0, velocity: null, velocityDelta: null, velocitySprints: 0,
  },
  throughput: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-07-${10 + i}`, count: 0 })),
  throughputChangePct: null,
  insight: { headline: 'Nothing on your plate yet', detail: 'Pick something up.', tone: 'info', highlights: [] },
  projects: [],
};

describe('buildHomeKpis', () => {
  it('returns no tiles before data arrives', () => {
    expect(buildHomeKpis(null)).toEqual([]);
  });

  it('renders dashes, not NaN, for a brand-new user', () => {
    const tiles = buildHomeKpis(EMPTY_HOME.kpis);
    expect(tiles.map((t) => t.value)).toEqual(['0', '—', '0d', '—']);
    expect(tiles.every((t) => t.delta === null)).toBe(true);
    expect(tiles[3].label).toBe('Velocity');
  });

  it('formats real numbers and deltas', () => {
    const tiles = buildHomeKpis({
      completed30: 47, completedDelta: 12, avgCycleDays: 2.8, avgCycleDeltaDays: -0.4,
      streakDays: 6, velocity: 38, velocityDelta: 3, velocitySprints: 5,
    });
    expect(tiles.map((t) => t.value)).toEqual(['47', '2.8d', '6d', '38pt']);
    expect(tiles[0].delta).toBe('+12');
    expect(tiles[1].delta).toBe('−0.4d');
    expect(tiles[1].good).toBe(true);
    expect(tiles[3].label).toBe('Velocity (5-sprint)');
  });
});

describe('HomePage', () => {
  it('renders server data with empty states and no sample-data note', async () => {
    analyticsApi.myHome.mockResolvedValue(EMPTY_HOME);
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(await screen.findByText('Nothing on your plate yet')).toBeInTheDocument();
    expect(screen.getByText(/not in any projects yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Nothing completed in the last 12 weeks/i)).toBeInTheDocument();
    expect(screen.queryByText(/sample/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('lists per-project load with a status', async () => {
    analyticsApi.myHome.mockResolvedValue({
      ...EMPTY_HOME,
      projects: [{
        projectId: 'p1', name: 'Atlas', slug: 'atlas', key: 'AT', type: 'Engineering', orgSlug: 'acme',
        openItems: 4, openPoints: 13, overdue: 1, status: 'At risk', statusTone: 'warning',
      }],
    });
    render(<MemoryRouter><HomePage /></MemoryRouter>);

    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('4 open · 13 pt · 1 overdue')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toHaveClass('status-warning');
  });
});
