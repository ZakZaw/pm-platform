import { marketingApi } from '@/api/marketing.api';
import { channelTokens } from '@/constants/projectTypes';

// Marketing roadmap: campaign bars by start/end date. Asset publish
// dates render as point markers inside each campaign's span. Channel
// color comes from the project-wide channel token map so it matches
// the calendar + campaigns list.
export async function marketingRoadmap(projectId) {
  const campaigns = await marketingApi.listCampaigns(projectId).catch(() => []);

  const bars = [];
  const points = [];
  for (const c of campaigns) {
    if (!c.startDate || !c.endDate) continue;
    const fg = channelTokens(c.channel).fg;
    bars.push({
      id: c.id,
      label: c.name,
      start: c.startDate,
      end: c.endDate,
      color: fg,
      sublabel: `${c.channel} · ${c.status}`,
    });
  }

  // Pull recent + upcoming asset publish dates as points (capped to the
  // next 90 days so this stays useful even on big projects).
  if (bars.length > 0) {
    const from = new Date(bars.reduce((m, b) => b.start < m ? b.start : m, bars[0].start));
    const to = new Date(bars.reduce((m, b) => b.end > m ? b.end : m, bars[0].end));
    try {
      const calendar = await marketingApi.getCalendar(projectId, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      for (const a of calendar?.assets ?? []) {
        if (!a.publishDate) continue;
        points.push({
          id: `asset-${a.id}`,
          label: a.title,
          at: a.publishDate,
          color: 'var(--text-secondary)',
          kind: 'milestone',
          sublabel: a.type,
        });
      }
    } catch {
      // Asset calendar is a nice-to-have; bars still render without it.
    }
  }

  const range = bars.length > 0
    ? {
        from: bars.reduce((m, b) => (b.start < m ? b.start : m), bars[0].start),
        to: bars.reduce((m, b) => (b.end > m ? b.end : m), bars[0].end),
      }
    : defaultRange();

  return {
    bars,
    points,
    range,
    emptyHint: bars.length === 0
      ? 'Add campaigns with start + end dates to see them as bars.'
      : undefined,
  };
}

function defaultRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to: new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString(),
  };
}
