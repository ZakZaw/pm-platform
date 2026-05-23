import { useEffect, useState } from 'react';
import { marketingApi } from '@/api/marketing.api';
import { channelTokens } from '@/constants/projectTypes';
import { DashboardWidget, MetricRow, StackedBar } from '../DashboardWidget';

function useCampaigns(projectId) {
  const [campaigns, setCampaigns] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    marketingApi.listCampaigns(projectId)
      .then((c) => { if (!cancelled) setCampaigns(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);
  return { campaigns, loading };
}

export function MarketingActiveCampaignsWidget({ project }) {
  const { campaigns, loading } = useCampaigns(project.id);
  const active = (campaigns ?? []).filter((c) => c.status === 'Active' || c.status === 'Planning');
  return (
    <DashboardWidget
      title="Active campaigns"
      eyebrow="Marketing"
      loading={loading}
      empty={!loading && active.length === 0}
      emptyText="No active campaigns."
    >
      <MetricRow label="Running" value={active.length} />
      <ul className="dashboard-widget__rows">
        {active.slice(0, 5).map((c) => (
          <li key={c.id} className="dashboard-widget__row">
            <span className="truncate">{c.name}</span>
            <span className="mono dim">{c.publishedAssetCount}/{c.assetCount} assets</span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function MarketingAssetsDueWidget({ project }) {
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 86_400_000).toISOString();
    marketingApi.getCalendar(project.id, { from, to })
      .then((c) => { if (!cancelled) setCalendar(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  const items = calendar?.assets ?? [];
  return (
    <DashboardWidget
      title="Assets due this week"
      eyebrow="Marketing"
      loading={loading}
      empty={!loading && items.length === 0}
      emptyText="No assets scheduled in the next 7 days."
    >
      <MetricRow label="Scheduled" value={items.length} />
      <ul className="dashboard-widget__rows">
        {items.slice(0, 5).map((a) => (
          <li key={a.id} className="dashboard-widget__row">
            <span className="truncate">{a.title}</span>
            <span className="mono dim">
              {new Date(a.publishDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </li>
        ))}
      </ul>
    </DashboardWidget>
  );
}

export function MarketingChannelMixWidget({ project }) {
  const { campaigns, loading } = useCampaigns(project.id);
  // Tally campaigns per channel for the donut/legend mix.
  const tallies = new Map();
  for (const c of campaigns ?? []) {
    tallies.set(c.channel, (tallies.get(c.channel) ?? 0) + 1);
  }
  const segments = Array.from(tallies.entries()).map(([channel, count]) => {
    // Resolve the design-token foreground for the channel so the
    // dashboard matches the calendar / campaigns list.
    const tokenString = channelTokens(channel).fg;
    return { label: channel, value: count, color: tokenString };
  });
  return (
    <DashboardWidget
      title="Channel mix"
      eyebrow="Marketing"
      loading={loading}
      empty={!loading && segments.length === 0}
      emptyText="Add campaigns to see the channel split."
    >
      {segments.length > 0 && <StackedBar segments={segments} />}
    </DashboardWidget>
  );
}
